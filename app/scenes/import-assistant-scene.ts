import { Composer, Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import Constants from "../util/constants";
import { message } from "telegraf/filters";
import InlineKeyboard from "../util/inline-keyboard";

const importAssistantScene = new Scenes.BaseScene<BotContext>(
  "importAssistantScene"
);

importAssistantScene.enter(async (ctx) => {
  const keyboard = new InlineKeyboard().text(
    ctx.t("asst:btn.back.assts"),
    "asst.back"
  );
  return ctx.replyWithHTML(ctx.t("asst:html.import"), {
    reply_markup: keyboard,
  });
});

importAssistantScene.action("asst.back", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("asst:cb.assts"));
  await ctx.scene.enter("assistantScene");
});

importAssistantScene.url(
  /https:\/\/chub\.ai\/characters\/([^\/]+\/[^\/]+)/g,
  async (ctx) => {
    const { openai, prisma } = ctx;

    const waitMessage = await ctx.replyWithHTML(ctx.t("html.wait"));

    const fullPath = ctx.match[1];
    const headers = {
      accept: "*/*",
      "Content-Type": "application/json",
    };
    const body = {
      format: "cai",
      fullPath,
      version: "main",
    };
    const res = await fetch(Constants.downloadChubUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const character = await res.json();

    let remoteAsst;
    try {
      remoteAsst = await openai.beta.assistants.create({
        model: "gpt-4o",
        name: character.name,
        instructions: `Imitate ${
          character.name
        } based on the character description and answer ${
          ctx.message?.from.first_name ?? "the user"
        }'s prompts based on ${
          character.name
        }'s personality.\n\nHere is the character description.\n${(
          character.description as string
        )
          .replace(/{{char}}/gi, character.name)
          .replace(
            /{{user}}/gi,
            ctx.message?.from.first_name ?? "User"
          )}\n\nHere is an example dialogue betweeen ${character.name} and ${
          ctx.message?.from.first_name
        }.\n${(character.definition as string)
          .replace(/{{char}}/gi, character.name)
          .replace(/{{user}}/gi, ctx.message?.from.first_name ?? "User")}`,
      });
    } catch (error) {
      const keyboard = new InlineKeyboard().text(
        ctx.t("asst:btn.back.assts"),
        "asst.back"
      );
      return ctx.replyWithHTML(`❌ OpenAI Error: ${error}`, {
        reply_markup: keyboard,
      });
    }

    const assistant = await prisma.assistant.create({
      data: {
        name: character.name,
        userId: ctx.message!.from.id,
        serversideId: remoteAsst.id,
        instructions: remoteAsst.instructions,
        image: character.image,
        greeting: character.greeting
          .replace(/{{char}}/gi, character.name)
          .replace(/{{user}}/gi, ctx.message?.from.first_name ?? "User"),
      },
    });

    await ctx.deleteMessage(waitMessage.message_id);
    await ctx.replyWithHTML(ctx.t("asst:html.imported"));
    await ctx.scene.enter("assistantScene", undefined, true);

    const keyboard = new InlineKeyboard()
      .row(
        InlineKeyboard.text(
          ctx.t("asst:btn.name"),
          `asst.${assistant.id}.name`
        ),
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
  }
);

importAssistantScene.url(/.+/g, async (ctx) => {
  const keyboard = new InlineKeyboard().text(
    ctx.t("asst:btn.back.assts"),
    "asst.back"
  );
  return ctx.replyWithHTML(ctx.t("asst:html.import.url.notsupported"), {
    reply_markup: keyboard,
  });
});

importAssistantScene.on(message(), async (ctx) => {
  const keyboard = new InlineKeyboard().text(
    ctx.t("asst:btn.back.assts"),
    "asst.back"
  );
  return ctx.replyWithHTML(ctx.t("asst:html.import.url.invalid"), {
    reply_markup: keyboard,
  });
});

export default importAssistantScene;
