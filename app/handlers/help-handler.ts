import BotContext from "../middlewares/bot-context";
import escapeHtml from "../util/escape-html";

const helpHandler = async (ctx: BotContext) => {
  const { openai, prisma } = ctx;
  const { id, first_name } = ctx.message!.from;

  try {
    await prisma.user.findUniqueOrThrow({ where: { id } });
  } catch (error) {
    const personalAssistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: `${ctx.from?.first_name}'s personal assistant`,
      instructions: `You are a personal AI assistant to ${ctx.from?.first_name}. Answer the user's questions in the user's language. Address the user using their first name.`,
      temperature: 0.7,
    });
    await prisma.user.create({
      data: {
        id,
        firstName: first_name,
        assistants: {
          create: {
            name: "Personal assistant",
            serversideId: personalAssistant.id,
            instructions: personalAssistant.instructions,
          },
        },
      },
    });
  }

  await ctx.scene.leave();

  await ctx.replyWithHTML(
    ctx.t("html.help") +
      `\n\nv${escapeHtml(process.env.BOT_VERSION ?? "?.?.?")}`
  );
};

export default helpHandler;
