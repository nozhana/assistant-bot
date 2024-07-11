import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { callbackQuery } from "telegraf/filters";

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

assistantScene.on(callbackQuery("data"), async (ctx) => {
  const data = ctx.callbackQuery.data.split(".");

  if (data[0] !== "asst") {
    await ctx.answerCbQuery("❌ Invalid callback.");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.reenter();
  }

  switch (data[1]) {
    case "new":
      await ctx.answerCbQuery("🤖 New assistant");
      await ctx.editMessageReplyMarkup(undefined);
      return ctx.scene.enter("newAssistantScene");
    case "back":
      await ctx.answerCbQuery("🤖 Assistants");
      await ctx.editMessageReplyMarkup(undefined);
      return ctx.scene.reenter();
    default:
      if (data.length === 3) {
        switch (data[2]) {
          case "del":
            return deleteAssistant(data[1]);
          case "chat":
            return newChatAssistant(data[1]);
          case "name":
          case "inst":
            return ctx.answerCbQuery("🛑 Not implemented", {
              show_alert: true,
            });
          default:
            return ctx.answerCbQuery("‼️ Unexpected data", {
              show_alert: true,
            });
        }
      } else {
        return showAssistantDetails(data[1]);
      }
  }

  async function showAssistantDetails(id: string) {
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
    buttons.push([{ text: "👈 Assistants", callback_data: "asst.back" }]);

    await ctx.answerCbQuery(`🤖 ${assistant.name}`);
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.replyWithHTML(
      `🤖 <b>Name:</b> <code>${assistant.name}</code>

☝️ <b>Instructions:</b>
<pre>${assistant.instructions}</pre>`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  }

  async function deleteAssistant(id: string) {
    const { prisma, openai } = ctx;
    const deleted = await prisma.assistant.delete({ where: { id } });
    const storeIds =
      (await openai.beta.assistants.retrieve(deleted.serversideId))
        .tool_resources?.file_search?.vector_store_ids ?? [];

    for (let storeId of storeIds) {
      await openai.beta.vectorStores.del(storeId);
    }

    await openai.beta.assistants.del(deleted.serversideId);
    await ctx.answerCbQuery("✅ Deleted assistant.", {
      show_alert: true,
    });
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.reenter();
  }

  async function newChatAssistant(id: string) {
    const { prisma } = ctx;
    const conversation = await prisma.conversation.create({
      data: { userId: ctx.from.id, assistantId: id },
    });
    await ctx.answerCbQuery("💬 Chatting");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.enter("chatScene", { conversationId: conversation.id });
  }
});

export default assistantScene;
