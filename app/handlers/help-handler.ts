import BotContext from "../middlewares/bot-context";
import escapeHtml from "../util/escape-html";

const helpHandler = async (ctx: BotContext) => {
  const { prisma } = ctx.session;
  const { id, first_name } = ctx.message!.from;

  try {
    await prisma.user.findUniqueOrThrow({ where: { id } });
  } catch (error) {
    await prisma.user.create({
      data: { id, firstName: first_name },
    });
  }

  await ctx.replyWithHTML(
    `💁 <b>Help</b>

/start or /help — ℹ️ Show this message
/chat — 💬 Talk to an assistant
/settings — ⚙️ Settings menu

v${escapeHtml(process.env.BOT_VERSION ?? "?.?.?")}`
  );
};

export default helpHandler;
