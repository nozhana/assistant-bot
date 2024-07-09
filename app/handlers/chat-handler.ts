import BotContext from "../middlewares/bot-context";

const chatHandler = async (ctx: BotContext) => {
  const { prisma, openai } = ctx.session;
  let personalAssistant = await prisma.assistant.findFirst({
    where: { userId: ctx.message?.from.id },
  });

  if (!personalAssistant) {
    const newAssistant = await openai.beta.assistants.create({
      model: "gpt-4o",
      name: `${ctx.from?.first_name}'s personal assistant`,
      instructions: `You are a personal assistant to ${ctx.from?.first_name}. You will answer their questions accordingly and address them directly.`,
    });

    personalAssistant = await prisma.assistant.create({
      data: {
        assistantId: newAssistant.id,
        name:
          newAssistant.name ?? `${ctx.from?.first_name}'s personal assistant`,
        user: {
          connect: { id: ctx.from?.id },
        },
      },
    });
  }

  const newConversation = await prisma.conversation.create({
    data: {
      assistant: {
        connect: { id: personalAssistant.id },
      },
      user: {
        connect: { id: ctx.from?.id },
      },
    },
  });

  ctx.session.currentConversationId = newConversation.id;
  return ctx.scene.enter("chatScene");
};

export default chatHandler;
