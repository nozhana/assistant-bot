import { NarrowedContext, Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { Update } from "telegraf/typings/core/types/typegram";
import { callbackQuery } from "telegraf/filters";
import InlineKeyboard from "../util/inline-keyboard";
import initializeUserAndPersonalAssistant from "../handlers/init-user";

const convScene = new Scenes.BaseScene<BotContext>("convScene");

convScene.enter(async (ctx) => {
  return listConversations(ctx);
});

convScene.action(/conv\.list\.\d+/g, async (ctx) => {
  const { prisma } = ctx;
  const page = Number(ctx.match[0].split(".").pop());
  const convsCount = await prisma.conversation.count({
    where: { userId: ctx.from.id },
  });
  const pages = Math.ceil(convsCount / 10);

  await ctx.answerCbQuery(ctx.t("conv:cb.convs.page", { page, pages }));
  await ctx.deleteMessage();
  return listConversations(ctx, page);
});

convScene.action("conv.back", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("conv:cb.convs"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

convScene.action("conv.asst", async (ctx) => {
  return chooseAssistant(ctx);
});

convScene.action(/conv\.asst\.list\.\d+/g, async (ctx) => {
  const page = Number(ctx.match[0].split(".").pop());
  return chooseAssistant(ctx, page);
});

convScene.action("conv.asst.new", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("asst:cb.new"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("newAssistantScene");
});

convScene.action(/conv\.asst\.[^.]+/g, async (ctx) => {
  const assistantId = ctx.match[0].split(".").pop()!;
  const { prisma } = ctx;
  const newConversation = await prisma.conversation.create({
    data: {
      assistantId,
      userId: ctx.from.id,
    },
    include: { assistant: true },
  });

  return enterConversation(ctx, newConversation.id);
});

convScene.action(/conv\.[^.]+\.cont/g, async (ctx) => {
  const conversationId = ctx.match[0].split(".")[1];
  return enterConversation(ctx, conversationId);
});

convScene.action(/conv\.[^.]+\.del/g, async (ctx) => {
  const conversationId = ctx.match[0].split(".")[1];
  return deleteConversation(ctx, conversationId);
});

convScene.action(/conv\.[^.]+\.hist/g, async (ctx) => {
  const conversationId = ctx.match[0].split(".")[1];
  return conversationHistory(ctx, conversationId);
});

convScene.action(/conv\.[^.]+$/g, async (ctx) => {
  const { prisma } = ctx;
  const conversationId = ctx.match[0].split(".").pop()!;
  const exists = await prisma.conversation.count({
    where: { id: conversationId },
  });

  if (!exists) {
    return ctx.reply(ctx.t("conv:html.conv.missing"));
  }

  return showConvDetails(ctx, conversationId);
});

async function listConversations(ctx: BotContext, page: number = 1) {
  const { prisma } = ctx;

  const conversations = await prisma.conversation.findMany({
    skip: (page - 1) * 10,
    take: 10,
    where: { userId: ctx.from?.id },
    include: { assistant: true },
  });

  const convsCount = await prisma.conversation.count({
    where: { userId: ctx.from?.id },
  });
  const pages = Math.ceil(convsCount / 10);

  const keyboard = new InlineKeyboard()
    .text(ctx.t("conv:btn.new"), "conv.asst")
    .rows(
      ...conversations.map((e) => [
        InlineKeyboard.text(e.title ?? e.assistant.name, `conv.${e.id}`),
      ])
    )
    .row(
      InlineKeyboard.text(
        ctx.t("btn.prev", { page: page - 1 }),
        `conv.list.${page - 1}`,
        page <= 1
      ),
      InlineKeyboard.text(
        ctx.t("btn.next", { page: page + 1 }),
        `conv.list.${page + 1}`,
        page >= pages
      )
    );

  const response = convsCount
    ? ctx.t("conv:html.convs", { page, pages })
    : ctx.t("conv:html.convs.empty");

  return ctx.replyWithHTML(response, {
    reply_markup: keyboard,
  });
}

async function chooseAssistant(
  ctx: NarrowedContext<BotContext, Update.CallbackQueryUpdate>,
  page: number = 1
) {
  const { prisma } = ctx;

  await initializeUserAndPersonalAssistant(ctx);

  const assistants = await prisma.assistant.findMany({
    where: {
      OR: [{ userId: ctx.from.id }, { guestIds: { has: ctx.from.id } }],
    },
  });
  const assistantsCount = await prisma.assistant.count({
    where: {
      OR: [{ userId: ctx.from.id }, { guestIds: { has: ctx.from.id } }],
    },
  });
  const pages = Math.ceil(assistantsCount / 10);

  const keyboard = new InlineKeyboard()
    .text(ctx.t("asst:btn.new"), "conv.asst.new")
    .rows(
      ...assistants.map((e) => [
        InlineKeyboard.text(e.name, `conv.asst.${e.id}`),
      ])
    )
    .row(
      InlineKeyboard.text(
        ctx.t("btn.prev", { page: page - 1 }),
        `conv.asst.list.${page - 1}`,
        page <= 1
      ),
      InlineKeyboard.text(
        ctx.t("btn.next", { page: page + 1 }),
        `conv.asst.list.${page + 1}`,
        page >= pages
      )
    )
    .text(ctx.t("btn.back"), "conv.back");

  await ctx.answerCbQuery(ctx.t("conv:cb.new"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(ctx.t("conv:html.new"), {
    reply_markup: keyboard,
  });
}

async function enterConversation(ctx: BotContext, conversationId: string) {
  await ctx.answerCbQuery(ctx.t("chat:cb.chatting"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("chatScene", { conversationId });
}

async function deleteConversation(ctx: BotContext, conversationId: string) {
  const { prisma } = ctx;
  await prisma.message.deleteMany({ where: { conversationId } });
  await prisma.conversation.delete({ where: { id: conversationId } });
  await ctx.answerCbQuery(ctx.t("conv:cb.deleted"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
}

async function conversationHistory(
  ctx: NarrowedContext<BotContext, Update.CallbackQueryUpdate>,
  conversationId: string
) {
  const { prisma } = ctx;
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { messages: true, assistant: true },
  });

  for (let message of conversation.messages) {
    const chunks = message.content.match(/[\s\S]{1,3895}/g) ?? [
      message.content,
    ];
    for (let chunk of chunks) {
      try {
        await ctx.replyWithMarkdown(
          `**${
            message.role === "ASSISTANT"
              ? "🤖 " + conversation.assistant.name
              : "👤 " + ctx.from.first_name
          }**

${chunk}
💸 **${message.tokens} ${ctx.t("conv:tokens")}**`
        );
      } catch (error) {
        await ctx.reply(
          `${
            message.role === "ASSISTANT"
              ? "🤖 " + conversation.assistant.name
              : "👤 " + ctx.from.first_name
          }

${chunk}
💸 ${message.tokens} ${ctx.t("conv:tokens")}`
        );
      }
    }
  }

  return showConvDetails(ctx, conversationId);
}

async function showConvDetails(ctx: BotContext, conversationId: string) {
  const { prisma } = ctx;
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { title: true, assistant: true },
  });

  const keyboard = new InlineKeyboard()
    .row(
      InlineKeyboard.text(
        ctx.t("conv:btn.continue"),
        `conv.${conversationId}.cont`
      ),
      InlineKeyboard.text(ctx.t("btn.delete"), `conv.${conversationId}.del`)
    )
    .text(ctx.t("conv:btn.history"), `conv.${conversationId}.hist`)
    .text(ctx.t("btn.back"), `conv.back`);

  await ctx.answerCbQuery(
    `💬 ${conversation.title ?? conversation.assistant.name}`
  );
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(
    `💬 <b>${conversation.title ?? "Undefined"}</b>
🤖 ${conversation.assistant.name}`,
    {
      reply_markup: keyboard,
    }
  );
}

export default convScene;
