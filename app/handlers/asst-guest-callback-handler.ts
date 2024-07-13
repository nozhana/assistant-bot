import { NarrowedContext } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { CallbackQuery, Update } from "telegraf/typings/core/types/typegram";
import escapeHtml from "../util/escape-html";

const asstGuestCallbackHandler = async (
  ctx: NarrowedContext<BotContext, Update.CallbackQueryUpdate>,
  next: () => Promise<void>
) => {
  const { prisma } = ctx;
  const { id } = ctx.from;
  if (!("data" in ctx.callbackQuery)) return next();
  const { data } = ctx.callbackQuery;
  if (!data.startsWith("guest")) return next();

  const assistantId = data.split(".").pop()!;

  const assistant = await prisma.assistant.findUnique({
    where: { id: assistantId },
  });

  if (!assistant)
    return ctx.answerCbQuery("🚫 This assistant has been deleted.", {
      show_alert: true,
    });

  const exists = await prisma.user.count({
    where: {
      id,
      OR: [
        { assistants: { some: { id: assistantId } } },
        { guestAssistantIds: { has: assistantId } },
      ],
    },
  });

  if (exists)
    return ctx.answerCbQuery(
      `🚫 You already have ${assistant.name} in your library.`,
      { show_alert: true }
    );

  await prisma.user.update({
    where: { id },
    data: { guestAssistants: { connect: { id: assistantId } } },
  });

  await ctx.answerCbQuery(`✅ ${assistant.name} added to library.`);
  await ctx.editMessageText(
    `✅ Assistant added to library successfully.
🤖 <b>Name:</b> <code>${escapeHtml(assistant.name)}</code>
☝️ <b>Instructions:</b>
<pre>${escapeHtml(assistant.instructions ?? "No instructions")}</pre>`,
    { reply_markup: undefined, parse_mode: "HTML" }
  );
};

export default asstGuestCallbackHandler;
