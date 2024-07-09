import { CallbackDataQueryBotContext } from "../middlewares/bot-context";

const convHandler = async (
  ctx: CallbackDataQueryBotContext,
  next: () => Promise<void>
) => {
  if (!ctx.callbackQuery.data.startsWith("conv")) return next();

  const { prisma, openai } = ctx.session;

  const conversationId = ctx.callbackQuery.data.split(".")[1];

  if (conversationId === "new") {
    // TODO: Start new conv scene
    let personalAssistant: {
      id: string;
      serversideId: string;
      name: string;
      userId: number;
    };

    try {
      personalAssistant = await prisma.assistant.findFirstOrThrow({
        where: { userId: ctx.from.id },
      });
    } catch (error) {
      const newAssistant = await openai.beta.assistants.create({
        model: "gpt-4o",
        name: `${ctx.from.first_name}'s personal assistant`,
        instructions: `You're a personal assistant to ${ctx.from.first_name}. Answer their questions accordingly and address them personally when responding.`,
        temperature: 0.7,
      });

      personalAssistant = await prisma.assistant.create({
        data: {
          serversideId: newAssistant.id,
          name: newAssistant.name!,
          userId: ctx.from.id,
        },
      });
    }

    const conversation = await prisma.conversation.create({
      data: { userId: ctx.from.id, assistantId: personalAssistant.id },
    });

    ctx.session.currentConversationId = conversation.id;
    return ctx.scene.enter("chatScene");
  }

  const exists = await prisma.conversation.count({
    where: { id: conversationId },
  });

  if (!exists) {
    return ctx.reply(
      `Conversation ${conversationId} doesn't exist in the database.`
    );
  }

  ctx.session.currentConversationId = conversationId;
  return ctx.scene.enter("chatScene");
};

export default convHandler;
