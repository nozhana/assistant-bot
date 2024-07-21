import { Scenes } from "telegraf";
import BotContext from "../../middlewares/bot-context";
import InlineKeyboard from "../../util/inline-keyboard";

const adminMenuScene = new Scenes.BaseScene<BotContext>("adminMenuScene");

adminMenuScene.enter(async (ctx) => {
  const keyboard = new InlineKeyboard().row(
    InlineKeyboard.text(ctx.t("admin:btn.users"), "admin.users.1"),
    InlineKeyboard.text(ctx.t("admin:btn.broadcast"), "admin.broadcast")
  );

  return ctx.replyWithHTML(ctx.t("admin:html.menu"), {
    reply_markup: keyboard,
  });
});

adminMenuScene.action(/admin\.users\.\d+/g, async (ctx) => {
  const { prisma } = ctx;
  const page = Number(ctx.match[0].split(".").pop());
  const users = await prisma.user.findMany({ skip: (page - 1) * 10, take: 10 });
  const usersCount = await prisma.user.count();
  const pages = Math.ceil(usersCount / 10);

  const keyboard = new InlineKeyboard()
    .rows(
      ...users.map((user) => [
        InlineKeyboard.text(
          `👤 ${user.firstName} - ${user.id}`,
          `admin.user.${user.id}`
        ),
      ])
    )
    .row(
      InlineKeyboard.text(
        ctx.t("btn.prev", { page: page - 1 }),
        `admin.users.${page - 1}`,
        page <= 1
      ),
      InlineKeyboard.text(
        ctx.t("btn.next", { page: page + 1 }),
        `admin.users.${page + 1}`,
        page >= pages
      )
    )
    .text(ctx.t("btn.back"), "admin.back");

  await ctx.answerCbQuery(ctx.t("admin:cb.users", { page, pages }));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(ctx.t("admin:html.users", { page, pages }), {
    reply_markup: keyboard,
  });
});

adminMenuScene.action(/admin\.user\.(\d+)$/g, async (ctx) => {
  const { prisma } = ctx;
  const userId = Number(ctx.match[1]);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { conversations: true, assistants: true, messages: true },
  });

  const keyboard = new InlineKeyboard()
    .text(ctx.t("btn.delete"), `admin.user.${userId}.del`)
    .text(ctx.t("btn.back"), "admin.users.1");

  await ctx.answerCbQuery(ctx.t("admin:cb.user", { id: user.id }));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(
    ctx.t("admin:html.user", {
      id: user.id,
      firstName: user.firstName,
      convLength: user.conversations.length,
      asstLength: user.assistants.length,
    }),
    {
      reply_markup: keyboard,
    }
  );
});

adminMenuScene.action(/admin\.user\.(\d+)\.del/g, async (ctx) => {
  const { openai, prisma } = ctx;
  const userId = Number(ctx.match[1]);

  await prisma.user.update({
    where: { id: userId },
    data: { guestAssistants: { set: [] } },
  });

  const user = await prisma.user.delete({
    where: { id: userId },
    include: { assistants: true },
  });

  for (let assistant of user.assistants) {
    try {
      const remoteAsst = await openai.beta.assistants.retrieve(
        assistant.serversideId
      );

      if (remoteAsst.tool_resources?.code_interpreter?.file_ids) {
        for (let fileId of remoteAsst.tool_resources.code_interpreter
          .file_ids) {
          try {
            await openai.files.del(fileId);
          } catch {}
        }
      }
      if (remoteAsst.tool_resources?.file_search?.vector_store_ids) {
        for (let storeId of remoteAsst.tool_resources.file_search
          .vector_store_ids) {
          try {
            const files = await openai.beta.vectorStores.files.list(storeId);
            for (let file of files.data) {
              try {
                await openai.beta.vectorStores.files.del(storeId, file.id);
              } catch {}
            }
            await openai.beta.vectorStores.del(storeId);
          } catch {}
        }
      }

      await openai.beta.assistants.del(assistant.serversideId);
    } catch {}
  }

  const keyboard = new InlineKeyboard().text(
    ctx.t("btn.back"),
    "admin.users.1"
  );
  await ctx.editMessageReplyMarkup(keyboard);
  return ctx.answerCbQuery(
    ctx.t("admin:cb.user.deleted", { user: user.firstName }),
    { show_alert: true }
  );
});

adminMenuScene.action("admin.broadcast", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("admin:cb.broadcast"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("adminBroadcastScene");
});

adminMenuScene.action("admin.back", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("admin:cb.menu"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

export default adminMenuScene;
