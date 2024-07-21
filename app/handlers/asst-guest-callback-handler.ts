import { NarrowedContext } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { CallbackQuery, Update } from "telegraf/typings/core/types/typegram";
import escapeHtml from "../util/escape-html";
import initializeUserAndPersonalAssistant from "./init-user";

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
    return ctx.answerCbQuery(ctx.t("asst:cb.guest.missing"), {
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
      ctx.t("asst:cb.guest.exists", { assistant: assistant.name }),
      { show_alert: true }
    );

  try {
    await prisma.user.update({
      where: { id },
      data: { guestAssistants: { connect: { id: assistantId } } },
    });
  } catch {
    await initializeUserAndPersonalAssistant(ctx);
    await prisma.user.update({
      where: { id },
      data: { guestAssistants: { connect: { id: assistantId } } },
    });
  }

  await ctx.answerCbQuery(
    ctx.t("asst:cb.guest.added", { assistant: assistant.name }),
    {
      show_alert: true,
    }
  );
  await ctx.editMessageText(
    ctx.t("asst:html.guest.added", {
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
    { reply_markup: undefined, parse_mode: "HTML" }
  );
};

export default asstGuestCallbackHandler;
