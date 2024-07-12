import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { AssistantTool } from "openai/resources/beta/assistants";

const assistantScene = new Scenes.BaseScene<BotContext>("assistantScene");

assistantScene.enter(async (ctx) => {
  const { prisma } = ctx;

  const assistants = await prisma.assistant.findMany({
    where: { userId: ctx.from?.id },
  });

  const buttons: InlineKeyboardButton[][] = [];
  buttons.push([{ text: "➕ New assistant", callback_data: "asst.new" }]);

  buttons.push(
    ...assistants.map((a) => [
      { text: `🤖 ${a.name}`, callback_data: `asst.${a.id}` },
    ])
  );

  return ctx.reply("Here's a list of all your assistants.", {
    reply_markup: { inline_keyboard: buttons },
  });
});

assistantScene.action("asst.back", async (ctx) => {
  await ctx.answerCbQuery("🤖 Assistants");
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

assistantScene.action("asst.new", async (ctx) => {
  await ctx.answerCbQuery("🤖 New assistant");
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("newAssistantScene");
});

assistantScene.action(/asst\.([^\.]+)\.del/g, async (ctx) => {
  const id = ctx.match[0].split(".")[1];
  const { prisma, openai } = ctx;
  const deleted = await prisma.assistant.delete({ where: { id } });
  const remoteAsst = await openai.beta.assistants.retrieve(
    deleted.serversideId
  );
  const storeIds =
    remoteAsst.tool_resources?.file_search?.vector_store_ids ?? [];
  const fileSearchFileIds: string[] = [];

  for (let storeId of storeIds) {
    const vectorFiles = await openai.beta.vectorStores.files.list(storeId);
    for (let vectorFile of vectorFiles.data) {
      fileSearchFileIds.push(vectorFile.id);
    }
  }

  const fileIds = [
    ...(remoteAsst.tool_resources?.code_interpreter?.file_ids ?? []),
    ...fileSearchFileIds,
  ];

  for (let fileId of fileIds) {
    await openai.files.del(fileId);
  }

  for (let storeId of storeIds) {
    await openai.beta.vectorStores.del(storeId);
  }

  await openai.beta.assistants.del(deleted.serversideId);
  await ctx.answerCbQuery("✅ Deleted assistant.", {
    show_alert: true,
  });
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

assistantScene.action(/asst\.([^\.]+)\.chat/g, async (ctx) => {
  const id = ctx.match[0].split(".")[1];
  const { prisma } = ctx;
  const conversation = await prisma.conversation.create({
    data: { userId: ctx.from.id, assistantId: id },
  });
  await ctx.answerCbQuery("💬 Chatting");
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("chatScene", { conversationId: conversation.id });
});

assistantScene.action(/asst\.([^\.]+)\.name/g, async (ctx) => {
  // const id = ctx.match[0].split(".")[1];
  return ctx.answerCbQuery("🛑 Not implemented.");
});

assistantScene.action(/asst\.([^\.]+)\.inst/g, async (ctx) => {
  return ctx.answerCbQuery("🛑 Not implemented.");
});

assistantScene.action(/asst\.([^\.]+)\.code/g, async (ctx) => {
  const id = ctx.match[0].split(".")[1];
  const { prisma, openai } = ctx;
  const localAsst = await prisma.assistant.findUniqueOrThrow({ where: { id } });
  const remoteAsst = await openai.beta.assistants.retrieve(
    localAsst.serversideId
  );
  const isCodeOn = remoteAsst.tools.filter(
    (v) => v.type === "code_interpreter"
  ).length;

  const tools: AssistantTool[] = remoteAsst.tools.filter(
    (v) => v.type !== "code_interpreter"
  );

  if (!isCodeOn) {
    tools.push({ type: "code_interpreter" });
  }

  await openai.beta.assistants.update(localAsst.serversideId, { tools });

  await ctx.answerCbQuery(
    `🧑‍💻 Code interpreter ${isCodeOn ? "OFF" : "ON"} for ${remoteAsst.name}.`,
    { show_alert: true }
  );
});

assistantScene.action(/asst\.([^\.]+)/g, async (ctx) => {
  const id = ctx.match[0].split(".").pop();
  if (!id) return ctx.scene.reenter();

  const { prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({
    where: { id },
  });

  const buttons: InlineKeyboardButton[][] = [];

  buttons.push([
    { text: "✏️ Name", callback_data: `asst.${assistant.id}.name` },
    { text: "✏️ Instructions", callback_data: `asst.${assistant.id}.inst` },
  ]);
  buttons.push([
    {
      text: "❇️ New conversation",
      callback_data: `asst.${assistant.id}.chat`,
    },
  ]);
  buttons.push([
    { text: "🗑️ Delete", callback_data: `asst.${assistant.id}.del` },
  ]);
  buttons.push([
    {
      text: "🧑‍💻 Code interpreter",
      callback_data: `asst.${assistant.id}.code`,
    },
  ]);
  buttons.push([{ text: "👈 Assistants", callback_data: "asst.back" }]);

  await ctx.answerCbQuery(`🤖 ${assistant.name}`);
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(
    `🤖 <b>Name:</b> <code>${assistant.name}</code>

☝️ <b>Instructions:</b>
<pre>${assistant.instructions}</pre>`,
    { reply_markup: { inline_keyboard: buttons } }
  );
});

export default assistantScene;
