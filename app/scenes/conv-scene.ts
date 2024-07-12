import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { callbackQuery } from "telegraf/filters";

const convScene = new Scenes.BaseScene<BotContext>("convScene");

convScene.enter(async (ctx) => {
  return listConversations(ctx);
});

convScene.use(async (ctx, next) => {
  if (ctx.text?.startsWith("/")) {
    await ctx.scene.leave();
  }
  return next();
});

convScene.on(callbackQuery("data"), async (ctx) => {
  const { prisma } = ctx;

  const data = ctx.callbackQuery.data.split(".");
  if (data[0] === "asst" && data[1] === "new") {
    await ctx.answerCbQuery("🤖 New Assistant");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.enter("newAssistantScene");
  }

  if (data[0] !== "conv") {
    // FIXME: Handle callback query data mismatch
    await ctx.answerCbQuery();
    return ctx.scene.leave();
  }

  if (data[1] === "list") {
    const page = Number(data[2]);
    const convsCount = await prisma.conversation.count({
      where: { userId: ctx.from.id },
    });

    await ctx.answerCbQuery(
      `💬 Conversations (page ${page} of ${(convsCount / 10 + 1).toFixed()})`
    );
    await ctx.deleteMessage();
    return listConversations(ctx, page);
  }

  if (data[1] === "new") {
    if (data.length === 2) return chooseAssistant();
    else if (data.length === 3) return createNewConversation(data[2]);
  }

  if (data[1] === "back") {
    await ctx.answerCbQuery("💬 Conversations");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.reenter();
  }

  if (data.length === 3) {
    switch (data[2]) {
      case "cont":
        return enterConversation(data[1]);
      case "del":
        return deleteConversation(data[1]);
      case "hist":
        return conversationHistory(data[1]);
      default:
        await ctx.answerCbQuery("💬 Conversations");
        await ctx.editMessageReplyMarkup(undefined);
        return ctx.scene.reenter();
    }
  }

  const exists = await prisma.conversation.count({
    where: { id: data[1] },
  });

  if (!exists) {
    return ctx.reply(`Conversation ${data[1]} doesn't exist in the database.`);
  }

  return showConvDetails(data[1]);

  async function showConvDetails(conversationId: string) {
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { title: true, assistant: true },
    });

    const buttons: InlineKeyboardButton[][] = [];

    buttons.push([
      {
        text: "💬 Continue",
        callback_data: `conv.${conversationId}.cont`,
      },
      {
        text: "🗑️ Delete",
        callback_data: `conv.${conversationId}.del`,
      },
    ]);

    buttons.push([
      { text: "📖 History", callback_data: `conv.${conversationId}.hist` },
    ]);

    buttons.push([
      { text: "👈 Back", callback_data: `conv.${conversationId}.back` },
    ]);

    await ctx.answerCbQuery(
      `💬 ${conversation.title ?? conversation.assistant.name}`
    );
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.replyWithHTML(
      `💬 <b>${conversation.title ?? "Undefined"}</b>
🤖 ${conversation.assistant.name}`,
      {
        reply_markup: {
          inline_keyboard: buttons,
        },
      }
    );
  }

  async function deleteConversation(conversationId: string) {
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } });
    await ctx.answerCbQuery("🗑️ Deleted Conversation.");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.reenter();
  }

  async function conversationHistory(conversationId: string) {
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
💸 **${message.tokens} tokens**`
          );
        } catch (error) {
          await ctx.sendMessage(
            `${
              message.role === "ASSISTANT"
                ? "🤖 " + conversation.assistant.name
                : "👤 " + ctx.from.first_name
            }

${chunk}
💸 ${message.tokens} tokens`
          );
        }
      }
    }

    return showConvDetails(conversationId);
  }

  async function createNewConversation(assistantId: string) {
    const newConversation = await prisma.conversation.create({
      data: {
        assistantId,
        userId: ctx.from.id,
      },
      include: { assistant: true },
    });

    return enterConversation(newConversation.id);
  }

  async function enterConversation(conversationId: string) {
    await ctx.answerCbQuery("💬 Chatting");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.enter("chatScene", { conversationId });
  }

  async function chooseAssistant() {
    const assistants = await prisma.assistant.findMany({
      where: { userId: ctx.from.id },
    });

    const buttons: InlineKeyboardButton[][] = [];
    buttons.push([{ text: "➕ New assistant", callback_data: "asst.new" }]);
    assistants.forEach((a) =>
      buttons.push([{ text: a.name, callback_data: "conv.new." + a.id }])
    );
    buttons.push([{ text: "👈 Back", callback_data: "conv.back" }]);

    await ctx.answerCbQuery("🤖 Choose assistant");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.replyWithHTML(
      "Choose an <b>assistant</b> to start a new conversation with.",
      { reply_markup: { inline_keyboard: buttons } }
    );
  }
});

async function listConversations(ctx: BotContext, page: number = 1) {
  const { prisma } = ctx;

  const conversations = await prisma.conversation.findMany({
    take: 10,
    skip: (page - 1) * 10,
    where: { userId: ctx.from?.id },
    include: { assistant: true },
  });

  const convsCount = await prisma.conversation.count({
    where: { userId: ctx.from?.id },
  });

  const buttons: InlineKeyboardButton[][] = [];
  buttons.push([{ text: "➕ New conversation", callback_data: "conv.new" }]);
  conversations.forEach((c) =>
    buttons.push([
      { text: c.title ?? c.assistant.name, callback_data: `conv.${c.id}` },
    ])
  );

  const navRow: InlineKeyboardButton[] = [];

  if (page > 1)
    navRow.push({
      text: `⬅️ Page ${page - 1}`,
      callback_data: `conv.list.${page - 1}`,
    });

  if (page * 10 < convsCount)
    navRow.push({
      text: `Page ${page + 1} ➡️`,
      callback_data: `conv.list.${page + 1}`,
    });

  if (navRow.length) buttons.push(navRow);

  const response = convsCount
    ? `💬 <b>Conversations</b>\n<i>Page ${page} of ${(
        convsCount / 10 +
        1
      ).toFixed()}</i>`
    : "💬 <b>You have no previous conversations.</b>";

  return ctx.replyWithHTML(response, {
    reply_markup: { inline_keyboard: buttons },
  });
}

export default convScene;
