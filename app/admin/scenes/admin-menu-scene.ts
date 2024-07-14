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

adminMenuScene.action(/admin\.users\.(\d+)/g, async (ctx) => {
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
    .text(ctx.t("btn.back"), "admin.reset");

  await ctx.answerCbQuery(ctx.t("admin:cb.users", { page, pages }));
  return ctx.editMessageText(ctx.t("admin:html.users", { page, pages }), {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
});

adminMenuScene.action(/admin\.user\.(.+)/g, async (ctx) => {
  const { prisma } = ctx;
  const userId = ctx.match[0].split(".").pop();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: Number(userId) },
    include: { conversations: true, assistants: true, messages: true },
  });

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
      reply_markup: {
        inline_keyboard: [
          [{ text: ctx.t("btn.back"), callback_data: "admin.users.1" }],
        ],
      },
    }
  );
});

adminMenuScene.action("admin.reset", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("admin:cb.menu"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

export default adminMenuScene;
