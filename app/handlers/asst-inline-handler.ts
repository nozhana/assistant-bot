import {
  InlineQueryResultArticle,
  Update,
} from "telegraf/typings/core/types/typegram";
import { NarrowedContext } from "telegraf";
import BotContext from "../middlewares/bot-context";
import escapeHtml from "../util/escape-html";

const asstInlineHandler = async (
  ctx: NarrowedContext<BotContext, Update.InlineQueryUpdate>,
  next: () => Promise<void>
) => {
  const { prisma } = ctx;
  const { query } = ctx.inlineQuery;

  let assistants;

  if (query.trim().length) {
    assistants = await prisma.assistant.findMany({
      where: {
        userId: ctx.from.id,
        name: { contains: query.trim(), mode: "insensitive" },
      },
    });
  } else {
    assistants = await prisma.assistant.findMany({
      where: { userId: ctx.from.id },
    });
  }

  if (!assistants.length) return next();

  const articles: InlineQueryResultArticle[] = [];

  for (let assistant of assistants) {
    if (assistant.name.toLowerCase() === "personal assistant") continue;
    articles.push({
      type: "article",
      id: assistant.id,
      title: `🤖 ${assistant.name}`,
      description: `☝️ ${assistant.instructions ?? "No instructions"}`,
      input_message_content: {
        message_text: `Here, try out this new assistant I created!
🤖 <b>Name:</b> <code>${escapeHtml(assistant.name)}</code>
☝️ <b>Instructions:</b>\n<pre>${escapeHtml(
          assistant.instructions ?? "No instructions"
        )}</pre>`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `⬇️ Add ${assistant.name} to assistants`,
              callback_data: `guest.${assistant.id}`,
            },
          ],
        ],
      },
    });
  }

  return ctx.answerInlineQuery(articles);
};

export default asstInlineHandler;
