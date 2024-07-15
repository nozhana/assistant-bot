import BotContext from "../middlewares/bot-context";

const initializeUserAndPersonalAssistant = async (ctx: BotContext) => {
  const { openai, prisma } = ctx;
  const { id, first_name } = ctx.from!;

  try {
    await prisma.assistant.findFirstOrThrow({
      where: { userId: id, name: "Personal assistant" },
    });
  } catch (error) {
    const personalAssistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: `${ctx.from?.first_name}'s personal assistant`,
      instructions: `You are a personal AI assistant to ${ctx.from?.first_name}. Answer the user's questions in the user's language. Address the user using their first name.`,
      temperature: 0.7,
    });
    await prisma.assistant.create({
      data: {
        user: {
          connectOrCreate: {
            where: { id },
            create: { id, firstName: first_name },
          },
        },
        name: "Personal assistant",
        serversideId: personalAssistant.id,
        instructions: personalAssistant.instructions,
      },
    });
  }
};

export default initializeUserAndPersonalAssistant;
