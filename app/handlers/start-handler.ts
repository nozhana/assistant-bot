import BotContext from "../middlewares/bot-context";
import escapeHtml from "../util/escape-html";

const startHandler = async (ctx: BotContext) => {
  const { prisma } = ctx.session;
  const { id, first_name } = ctx.message!.from;

  let user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    user = await prisma.user.create({ data: { id, firstName: first_name } });
  }

  await ctx.replyWithHTML(
    `💁 <b>Commands</b>

Hi, ${first_name}!
/start or /help — show this message
/chat — Talk to an assistant
/voice — Toggle voice output by default
/lang — Change UI language

v${escapeHtml(process.env.BOT_VERSION ?? "?.?.?")}`
  );
};

export default startHandler;
