import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import InlineKeyboard from "../util/inline-keyboard";
import { assistantDetails } from "./assistant-scene";

const fileScene = new Scenes.BaseScene<BotContext>("fileScene");

fileScene.enter(async (ctx) => {
  const { assistantId } = ctx.scene.state as { assistantId: string };
  return listFiles(ctx, assistantId);
});

fileScene.action("files.back", async (ctx) => {
  const { assistantId } = ctx.scene.state as { assistantId: string };
  await ctx.answerCbQuery();
  await ctx.deleteMessage();
  await ctx.scene.enter("assistantScene", undefined, true);
  return assistantDetails(ctx, assistantId);
});

fileScene.action(/^files\.list(?:\.(\d+))?$/g, async (ctx) => {
  const { assistantId } = ctx.scene.state as { assistantId: string };
  const page = Number(ctx.match[1] || 1);
  const { prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({
    where: { id: assistantId },
  });
  ctx.scene.state = { ...ctx.scene.state, page };
  await ctx.answerCbQuery(
    ctx.t("files:cb.files.page", { assistant: assistant.name, page })
  );
  await ctx.deleteMessage();
  return listFiles(ctx, assistantId, page);
});

fileScene.action(/^files\.([^.]+)$/g, async (ctx) => {
  const id = ctx.match[1];
  await ctx.answerCbQuery(ctx.t("files:cb.file"));
  await ctx.deleteMessage();
  return fileDetails(ctx, id);
});

fileScene.action(/^files\.([^.]+)\.del$/g, async (ctx) => {
  const { assistantId } = ctx.scene.state as { assistantId: string };
  const id = ctx.match[1];
  const { openai, prisma } = ctx;
  const file = await prisma.file.findUniqueOrThrow({ where: { id } });
  await openai.files.del(file.serversideId);
  await prisma.file.delete({ where: { id } });
  await ctx.answerCbQuery(ctx.t("files:cb.deleted", { file: file.filename }), {
    show_alert: true,
  });
  await ctx.deleteMessage();
  return listFiles(ctx, assistantId);
});

fileScene.action("files.del.all", async (ctx) => {
  const { assistantId } = ctx.scene.state as { assistantId: string };
  const { openai, prisma } = ctx;
  const files = await prisma.file.findMany({ where: { assistantId } });
  for (const file of files) {
    try {
      await openai.files.del(file.serversideId);
    } catch {}
  }
  await prisma.file.deleteMany({ where: { assistantId } });
  await ctx.answerCbQuery(ctx.t("files:cb.deleted.all"), { show_alert: true });
  await ctx.deleteMessage();
  await ctx.scene.enter("assistantScene", undefined, true);
  return assistantDetails(ctx, assistantId);
});

fileScene.action(/^files\.([^.]+)\.code$/g, async (ctx) => {
  const { assistantId } = ctx.scene.state as { assistantId: string };
  const id = ctx.match[1];
  const { openai, prisma } = ctx;

  const file = await prisma.file.findUniqueOrThrow({
    where: { id },
    include: { assistant: true },
  });

  const filesForUpdate = await prisma.file.findMany({
    where: {
      assistantId,
      codeInterpreter: true,
      id: { not: file.codeInterpreter ? file.id : undefined },
    },
  });

  await openai.beta.assistants.update(file.assistant.serversideId, {
    tool_resources: {
      code_interpreter: { file_ids: filesForUpdate.map((e) => e.serversideId) },
    },
  });

  await prisma.file.update({
    where: { id },
    data: { codeInterpreter: !file.codeInterpreter },
  });

  await ctx.answerCbQuery(
    file.codeInterpreter
      ? ctx.t("files:cb.code.off")
      : ctx.t("files:cb.code.on"),
    { show_alert: true }
  );
  await ctx.deleteMessage();
  return fileDetails(ctx, id);
});

fileScene.action(/^files\.([^.]+)\.filesearch$/g, async (ctx) => {
  return ctx.answerCbQuery(ctx.t("files:cb.filesearch.unavailable"), {
    show_alert: true,
  });
});

const listFiles = async (
  ctx: BotContext,
  assistantId: string,
  page: number = 1
) => {
  const { prisma } = ctx;
  const files = await prisma.file.findMany({
    take: 10,
    skip: (page - 1) * 10,
    where: { assistantId },
    include: { assistant: true },
  });
  const fileCount = await prisma.file.count({ where: { assistantId } });
  const pages = Math.ceil(fileCount / 10);
  ctx.scene.state = { assistantId, page };

  const assistant = await prisma.assistant.findUniqueOrThrow({
    where: { id: assistantId },
  });

  const keyboard = new InlineKeyboard()
    .rows(
      ...files.map((file) => [
        InlineKeyboard.text("📁 " + file.filename, `files.${file.id}`),
      ])
    )
    .row(
      InlineKeyboard.text(
        ctx.t("btn.prev", { page: page - 1 }),
        `files.list.${page - 1}`,
        page <= 1
      ),
      InlineKeyboard.text(
        ctx.t("btn.next", { page: page + 1 }),
        `files.list.${page + 1}`,
        page >= pages
      )
    )
    .text(ctx.t("files:btn.del.all"), "files.del.all", !fileCount)
    .text(ctx.t("btn.back"), "files.back");

  return ctx.replyWithHTML(
    files.length
      ? ctx.t("files:html.list", { assistant: assistant.name })
      : ctx.t("files:html.empty"),
    {
      reply_markup: keyboard,
    }
  );
};

const fileDetails = async (ctx: BotContext, id: string) => {
  const { prisma } = ctx;
  const { page } = ctx.scene.state as { page: number };
  const file = await prisma.file.findUniqueOrThrow({
    where: { id },
    include: { assistant: true },
  });

  const keyboard = new InlineKeyboard()
    .text(
      (file.codeInterpreter ? "✅ " : "") + ctx.t("files:btn.codeinterpreter"),
      `files.${id}.code`
    )
    .text(
      (file.fileSearch ? "✅ " : "") + ctx.t("files:btn.filesearch"),
      `files.${id}.filesearch`
    )
    .row(
      InlineKeyboard.text(ctx.t("btn.back"), `files.list.${page}`),
      InlineKeyboard.text(ctx.t("btn.delete"), `files.${id}.del`)
    );

  return ctx.replyWithHTML(
    ctx.t("files:html.file", {
      id: file.id,
      filename: file.filename,
      assistant: file.assistant.name,
    }),
    { reply_markup: keyboard }
  );
};

export default fileScene;
