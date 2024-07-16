import {
  InlineQueryResultArticle,
  Update,
} from "telegraf/typings/core/types/typegram";
import { NarrowedContext } from "telegraf";
import BotContext from "../middlewares/bot-context";
import escapeHtml from "../util/escape-html";
import Constants from "../util/constants";

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
      thumbnail_url: assistant.image ?? Constants.thumbnail(assistant.name),
      title: `🤖 ${assistant.name}`,
      description: `☝️ ${
        (assistant.instructions?.length ?? 0) > 3895
          ? ctx.t("asst:html.inst.toolong")
          : assistant.instructions
              ?.replace(/{{char}}/gi, assistant.name)
              .replace(/{char}/gi, assistant.name)
              .replace(/{{user}}/gi, ctx.from.first_name)
              .replace(/{user}/gi, ctx.from.first_name)
              .slice(0, 512) ?? ctx.t("asst:inline.article.no.inst")
      }`,
      input_message_content: {
        message_text: ctx.t("asst:inline.html.guest", {
          assistant: assistant.name,
          instructions:
            (assistant.instructions?.length ?? 0) > 3895
              ? ctx.t("asst:html.inst.toolong")
              : escapeHtml(
                  assistant.instructions
                    ?.replace(/{{char}}/gi, assistant.name)
                    .replace(/{char}/gi, assistant.name)
                    .replace(/{{user}}/gi, ctx.from.first_name)
                    .replace(/{user}/gi, ctx.from.first_name) ??
                    ctx.t("asst:inline.article.no.inst")
                ),
        }),
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: ctx.t("asst:inline.btn.asst.add", {
                assistant: assistant.name,
              }),
              callback_data: `guest.${assistant.id}`,
            },
          ],
        ],
      },
    });
  }

  return ctx.answerInlineQuery(articles, { cache_time: 5 });
};

export default asstInlineHandler;
