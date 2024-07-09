import {
  InlineKeyboardButton,
  Update,
  CallbackQuery,
} from "telegraf/typings/core/types/typegram";
import BotContext from "../middlewares/bot-context";
import { NarrowedContext } from "telegraf";
import chatHandler from "./chat-handler";

const convHandler = async (ctx: BotContext) => {
  const { prisma } = ctx.session;
  const conversations = await prisma.conversation.findMany({
    where: { userId: ctx.message?.from.id },
    include: { assistant: true },
  });

  if (!conversations.length) return ctx.reply("No conversations.");

  let buttons: InlineKeyboardButton[][] = [];

  for (let index = 0; index < conversations.length; index++) {
    const { id, assistant } = conversations[index];
    buttons.push([{ text: assistant.name, callback_data: `assistant${id}` }]);
  }

  return ctx.replyWithHTML("<b>Here is a list of all your conversations.</b>", {
    reply_markup: { inline_keyboard: buttons },
  });
};

const convEnterChatHandler = async (
  ctx: NarrowedContext<
    BotContext,
    Update.CallbackQueryUpdate<Record<"data", {}> & CallbackQuery.DataQuery>
  >
) => {
  const match = Array.from(
    ctx.callbackQuery.data.matchAll(/assistant(.+)/g),
    (m) => m[1]
  )[0];
  ctx.session.currentConversationId = Number(match);
  return ctx.scene.enter("chatScene");
};

export default chatHandler;
