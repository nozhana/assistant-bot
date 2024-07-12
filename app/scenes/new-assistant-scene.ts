import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { callbackQuery, message } from "telegraf/filters";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";

const newAssistantScene = new Scenes.BaseScene<BotContext>("newAssistantScene");

newAssistantScene.enter(async (ctx) => {
  ctx.scene.session.step = 0;
  return ctx.replyWithHTML("🤖 Enter a new <b>name</b> for the assistant.", {
    reply_markup: {
      inline_keyboard: [[{ text: "❌ Cancel", callback_data: "asst.cancel" }]],
    },
  });
});

newAssistantScene.on(message("text"), async (ctx) => {
  switch (ctx.scene.session.step) {
    case 0:
      return storeNameAndGetInstructions();
    case 1:
      return storeInstructionsAndConfirm();
    default:
      break;
  }

  async function storeNameAndGetInstructions() {
    ctx.scene.state = { name: ctx.text };
    ctx.scene.session.step = 1;
    return ctx.replyWithHTML(
      "☝️ Enter the <b>instructions</b> for your assistant.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "asst.cancel" }],
          ],
        },
      }
    );
  }

  async function storeInstructionsAndConfirm() {
    ctx.scene.state = { ...ctx.scene.state, instructions: ctx.text };
    const asstName = (ctx.scene.state as { name: string; instructions: string })
      .name;
    ctx.scene.session.step = 2;
    return ctx.replyWithHTML(
      `👀 Create assistant with this configuration?

🤖 <b>Name:</b> <code>${asstName}</code>
☝️ <b>Instructions:</b>
<code>${ctx.text}</code>`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❌ Cancel", callback_data: "asst.cancel" },
              { text: "✏️ Try again", callback_data: "asst.reset" },
            ],
            [{ text: "✅ Create", callback_data: "asst.create" }],
          ],
        },
      }
    );
  }
});

newAssistantScene.on(callbackQuery("data"), async (ctx, next) => {
  const { prisma, openai } = ctx;
  const data = ctx.callbackQuery.data.split(".");
  if (data[0] !== "asst") return next();

  switch (data[1]) {
    case "cancel":
      await ctx.answerCbQuery("❌ Cancelled.");
      await ctx.editMessageReplyMarkup(undefined);
      return ctx.scene.leave();
    case "reset":
      await ctx.answerCbQuery("🔄 Restarted process.");
      await ctx.editMessageReplyMarkup(undefined);
      return ctx.scene.reenter();
    case "create":
      return createNewAssistantAndLeave();
    default:
      return next();
  }

  async function createNewAssistantAndLeave() {
    const { name, instructions } = ctx.scene.state as {
      name: string;
      instructions: string;
    };
    await ctx.answerCbQuery("🛜 Creating assistant...");
    await ctx.editMessageReplyMarkup(undefined);
    const waitMessage = await ctx.replyWithHTML(
      "<i>Creating new assistant, please wait...</i>"
    );
    await ctx.sendChatAction("typing");
    const remoteAsst = await openai.beta.assistants.create({
      model: "gpt-4o",
      name,
      instructions,
      temperature: 0.7,
    });
    const localAsst = await prisma.assistant.create({
      data: {
        name,
        instructions,
        serversideId: remoteAsst.id,
        userId: ctx.from.id,
      },
    });
    await ctx.replyWithHTML(`❇️ <b>Created new assistant successfully.</b>`);
    await ctx.deleteMessage(waitMessage.message_id);
    await ctx.scene.enter("assistantScene", undefined, true);
    return showAssistantDetails(localAsst);
  }

  async function showAssistantDetails(assistant: {
    id: string;
    name: string;
    instructions: string | null;
  }) {
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

    return ctx.replyWithHTML(
      `🤖 <b>Name:</b> <code>${assistant.name}</code>

☝️ <b>Instructions:</b>
<pre>${assistant.instructions}</pre>`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  }
});

export default newAssistantScene;
