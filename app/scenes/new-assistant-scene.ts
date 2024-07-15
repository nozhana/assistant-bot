import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { message } from "telegraf/filters";
import InlineKeyboard from "../util/inline-keyboard";
import Constants from "../util/constants";
import { createReadStream } from "fs";

const newAssistantScene = new Scenes.BaseScene<BotContext>("newAssistantScene");

newAssistantScene.enter(async (ctx) => {
  ctx.scene.session.step = 0;
  const keyboard = new InlineKeyboard().text(
    ctx.t("btn.cancel"),
    "asst.cancel"
  );
  return ctx.replyWithHTML(ctx.t("asst:html.asst.new.name"), {
    reply_markup: keyboard,
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
    const keyboard = new InlineKeyboard().text(
      ctx.t("btn.cancel"),
      "asst.cancel"
    );
    return ctx.replyWithHTML(ctx.t("asst:html.asst.new.inst"), {
      reply_markup: keyboard,
    });
  }

  async function storeInstructionsAndConfirm() {
    ctx.scene.state = { ...ctx.scene.state, instructions: ctx.text };
    const asstName = (ctx.scene.state as { name: string; instructions: string })
      .name;
    ctx.scene.session.step = 2;

    const keyboard = new InlineKeyboard()
      .row(
        InlineKeyboard.text(ctx.t("btn.cancel"), "asst.cancel"),
        InlineKeyboard.text(ctx.t("asst:btn.retry"), "asst.restart")
      )
      .text(ctx.t("asst:btn.create"), "asst.create");

    return ctx.replyWithHTML(
      ctx.t("asst:html.asst.new.confirm") +
        "\n\n" +
        ctx.t("asst:html.asst", {
          assistant: asstName,
          instructions: ctx.text,
        }),
      { reply_markup: keyboard }
    );
  }
});

newAssistantScene.action("asst.cancel", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("asst:cb.cancelled"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("assistantScene");
});

newAssistantScene.action("asst.restart", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("asst:cb.restarted"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

newAssistantScene.action("asst.create", async (ctx) => {
  const { openai, prisma } = ctx;
  const { name, instructions } = ctx.scene.state as {
    name: string;
    instructions: string;
  };
  await ctx.answerCbQuery(ctx.t("asst:cb.creating"));
  await ctx.editMessageReplyMarkup(undefined);
  const waitMessage = await ctx.replyWithHTML(ctx.t("asst:html.creating"));
  await ctx.sendChatAction("typing");
  const remoteAsst = await openai.beta.assistants.create({
    model: "gpt-4o",
    name,
    instructions,
    temperature: 0.7,
  });
  const assistant = await prisma.assistant.create({
    data: {
      name,
      instructions,
      serversideId: remoteAsst.id,
      userId: ctx.from.id,
    },
  });
  await ctx.replyWithHTML(ctx.t("asst:html.created"));
  await ctx.deleteMessage(waitMessage.message_id);
  await ctx.scene.enter("assistantScene", undefined, true);

  const keyboard = new InlineKeyboard()
    .row(
      InlineKeyboard.text(ctx.t("asst:btn.name"), `asst.${assistant.id}.name`),
      InlineKeyboard.text(ctx.t("asst:btn.inst"), `asst.${assistant.id}.inst`)
    )
    .text(ctx.t("asst:btn.conv.new"), `asst.${assistant.id}.chat`)
    .text(ctx.t("asst:btn.codeinterpreter"), `asst.${assistant.id}.code`)
    .switchToChat(ctx.t("asst:btn.share"), assistant.name)
    .text(ctx.t("btn.delete"), `asst.${assistant.id}.del`)
    .text(ctx.t("asst:btn.back.assts"), "asst.back");

  try {
    await ctx.replyWithPhoto(
      assistant.image ?? Constants.thumbnail(assistant.name),
      {
        caption: ctx.t("asst:html.asst", {
          assistant: assistant.name,
          instructions: assistant.instructions,
        }),
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );
  } catch (error) {
    try {
      await ctx.replyWithPhoto(
        assistant.image ?? Constants.thumbnail(assistant.name),
        { caption: `🖼️ <b>${assistant.name}</b>`, parse_mode: "HTML" }
      );
    } catch {
      await ctx.replyWithPhoto(Constants.thumbnail(assistant.name), {
        caption: `🖼️ <b>${assistant.name}</b>`,
        parse_mode: "HTML",
      });
    }
    try {
      await ctx.replyWithHTML(
        ctx.t("asst:html.asst", {
          assistant: assistant.name,
          instructions: assistant.instructions,
        }),
        { reply_markup: keyboard }
      );
    } catch {
      await ctx.replyWithHTML(
        ctx.t("asst:html.asst", {
          assistant: assistant.name,
          instructions: ctx.t("asst:html.inst.toolong"),
        }),
        { reply_markup: keyboard }
      );
    }
  }
});

export default newAssistantScene;
