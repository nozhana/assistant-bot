import BotContext from "../middlewares/bot-context";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";

const chatHandler = async (ctx: BotContext) => {
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
};

export default chatHandler;
