import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { AssistantTool } from "openai/resources/beta/assistants";

const assistantScene = new Scenes.BaseScene<BotContext>("assistantScene");

assistantScene.enter(async (ctx) => {
  return listAssistants(ctx);
});

const listAssistants = async (ctx: BotContext, page: number = 1) => {
  const { prisma } = ctx;
  if (!ctx.from) return ctx.scene.leave();

  const assistants = await prisma.assistant.findMany({
    skip: (page - 1) * 10,
    take: 10,
    where: {
      OR: [{ userId: ctx.from.id }, { guestIds: { has: ctx.from.id } }],
    },
  });

  const assistantsCount = await prisma.assistant.count({
    where: {
      OR: [{ userId: ctx.from.id }, { guestIds: { has: ctx.from.id } }],
    },
  });

  const pages = Math.ceil(assistantsCount / 10);

  const buttons: InlineKeyboardButton[][] = [];
  buttons.push([{ text: "➕ New assistant", callback_data: "asst.new" }]);

  buttons.push(
    ...assistants.map((a) => [
      { text: `🤖 ${a.name}`, callback_data: `asst.${a.id}` },
    ])
  );

  const navRow: InlineKeyboardButton[] = [];

  if (page > 1)
    navRow.push({
      text: `⬅️ Page ${page - 1}`,
      callback_data: `asst.list.${page - 1}`,
    });

  if (page < pages)
    navRow.push({
      text: `Page ${page + 1} ➡️`,
      callback_data: `asst.list.${page + 1}`,
    });

  if (navRow.length) buttons.push(navRow);

  return ctx.replyWithHTML("🤖 <b>Assistants</b>", {
    reply_markup: { inline_keyboard: buttons },
  });
};

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

assistantScene.action(/asst\.list\.(\d+)/g, async (ctx) => {
  const page = Number(ctx.match[0].split(".").pop());
  return listAssistants(ctx, page);
});

assistantScene.action(/asst\.([^\.]+)\.del/g, async (ctx) => {
  const id = ctx.match[0].split(".")[1];
  const { prisma, openai } = ctx;
  const isGuest = await prisma.user.count({
    where: {
      id: ctx.from.id,
      guestAssistantIds: { has: id },
      assistants: { none: { id } },
    },
  });

  if (isGuest) {
    await prisma.user.update({
      where: { id: ctx.from.id },
      data: { guestAssistants: { disconnect: { id } } },
    });
  } else {
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
  }

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
  return ctx.answerCbQuery("🛑 Not implemented.", { show_alert: true });
});

assistantScene.action(/asst\.([^\.]+)\.inst/g, async (ctx) => {
  return ctx.answerCbQuery("🛑 Not implemented.", { show_alert: true });
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

assistantScene.action(/asst\.([^\.]+)$/g, async (ctx) => {
  const id = ctx.match[0].split(".").pop();
  if (!id) return ctx.scene.reenter();

  const { prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({
    where: { id },
  });

  const isGuest = await prisma.user.count({
    where: {
      id: ctx.from.id,
      guestAssistantIds: { has: id },
      assistants: { none: { id } },
    },
  });

  const isPersonalAssistant =
    assistant.name.toLowerCase() === "personal assistant";

  const buttons: InlineKeyboardButton[][] = [];

  if (!isGuest && !isPersonalAssistant) {
    buttons.push([
      { text: "✏️ Name", callback_data: `asst.${assistant.id}.name` },
      { text: "✏️ Instructions", callback_data: `asst.${assistant.id}.inst` },
    ]);
  }

  buttons.push([
    {
      text: "❇️ New conversation",
      callback_data: `asst.${assistant.id}.chat`,
    },
  ]);

  if (!isGuest && !isPersonalAssistant) {
    buttons.push([
      {
        text: "🧑‍💻 Code interpreter",
        callback_data: `asst.${assistant.id}.code`,
      },
    ]);
    buttons.push([
      {
        text: "↗️ Share assistant",
        switch_inline_query_chosen_chat: {
          allow_bot_chats: false,
          allow_channel_chats: false,
          allow_group_chats: false,
          allow_user_chats: true,
          query: assistant.name,
        },
      },
    ]);
  }

  if (!isPersonalAssistant)
    buttons.push([
      { text: "🗑️ Delete", callback_data: `asst.${assistant.id}.del` },
    ]);

  buttons.push([{ text: "👈 Assistants", callback_data: "asst.back" }]);

  let response = `🤖 <b>Name:</b> <code>${assistant.name}</code>

☝️ <b>Instructions:</b>
<pre>${assistant.instructions}</pre>`;

  if (!isPersonalAssistant && !isGuest && assistant.guestIds.length)
    response += `\n\n↗️ <b>Shared with ${assistant.guestIds.length} ${
      assistant.guestIds.length === 1 ? "person" : "people"
    }.</b>`;

  await ctx.answerCbQuery(`🤖 ${assistant.name}`);
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(response, {
    reply_markup: { inline_keyboard: buttons },
  });
});

export default assistantScene;
