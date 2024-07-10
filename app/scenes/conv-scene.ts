import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { callbackQuery } from "telegraf/filters";

const convScene = new Scenes.BaseScene<BotContext>("convScene");

convScene.enter(async (ctx) => {
  const { prisma } = ctx.session;

  const conversations = await prisma.conversation.findMany({
    where: { userId: ctx.from?.id },
    include: { assistant: true },
  });

  const buttons: InlineKeyboardButton[][] = [];
  buttons.push([{ text: "➕ New conversation", callback_data: "conv.new" }]);
  conversations.forEach((c) =>
    buttons.push([
      { text: c.title ?? c.assistant.name, callback_data: `conv.${c.id}` },
    ])
  );

  return ctx.reply(
    conversations.length
      ? "Here's a list of all your conversations with your assistants."
      : "You have no previous conversations.",
    {
      reply_markup: { inline_keyboard: buttons },
    }
  );
});

convScene.use(async (ctx, next) => {
  if (ctx.text?.startsWith("/")) {
    await ctx.scene.leave();
  }
  return next();
});

convScene.on(callbackQuery("data"), async (ctx) => {
  const { prisma } = ctx.session;

  const showConvDetails = async (conversationId: string) => {
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
  };

  const deleteConversation = async (conversationId: string) => {
    await prisma.message.deleteMany({ where: { conversationId } });
    await prisma.conversation.delete({ where: { id: conversationId } });
    await ctx.answerCbQuery("🗑️ Deleted Conversation.");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.reenter();
  };

  const conversationHistory = async (conversationId: string) => {
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { messages: true, assistant: true },
    });

    for (let message of conversation.messages) {
      try {
        await ctx.replyWithMarkdown(
          `**${
            message.role === "ASSISTANT"
              ? "🤖 " + conversation.assistant.name
              : "👤 " + ctx.from.first_name
          }**
${message.content}
💸 **${message.tokens} tokens**`
        );
      } catch (error) {
        await ctx.sendMessage(
          `${
            message.role === "ASSISTANT"
              ? "🤖 " + conversation.assistant.name
              : "👤 " + ctx.from.first_name
          }
${message.content}
💸 ${message.tokens} tokens`
        );
      }
    }

    return showConvDetails(conversationId);
  };

  const chooseAssistant = async () => {
    const assistants = await prisma.assistant.findMany({
      where: { userId: ctx.from.id },
    });

    const buttons: InlineKeyboardButton[][] = assistants.map((a) => [
      { text: a.name, callback_data: `conv.new.${a.id}` },
    ]);

    await ctx.answerCbQuery("New conversation");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.replyWithHTML(
      "Choose an <b>assistant</b> to start a new conversation with.",
      { reply_markup: { inline_keyboard: buttons } }
    );
  };

  const createNewConversation = async (assistantId: string) => {
    const newConversation = await prisma.conversation.create({
      data: {
        assistantId,
        userId: ctx.from.id,
      },
      include: { assistant: true },
    });

    return enterConversation(newConversation.id);
  };

  const enterConversation = async (conversationId: string) => {
    await ctx.answerCbQuery("💬 Chatting");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.enter("chatScene", { conversationId });
  };

  const data = ctx.callbackQuery.data.split(".");
  if (data[0] !== "conv") {
    // FIXME: Handle callback query data mismatch
    await ctx.answerCbQuery();
    return ctx.scene.leave();
  }

  if (data[1] === "new") {
    if (data.length === 2) return chooseAssistant();
    else if (data.length === 3) return createNewConversation(data[2]);
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
});

export default convScene;
