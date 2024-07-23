import { Scenes } from "telegraf";
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
  await ctx.editMessageReplyMarkup(undefined);
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

    const instructions = `Imitate {{char}} based on the character description and answer {{user}}'s prompts based on {{char}}'s personality.

Here is the character description.
${character.description}

Here is an example dialogue betweeen {{char}} and {{user}}.
${character.definition}`;

    let remoteAsst;
    try {
      remoteAsst = await openai.beta.assistants.create({
        model: "gpt-4o",
        name: character.name,
        instructions: instructions
          .replace(/{{char}}/gi, character.name)
          .replace(/{char}/gi, character.name),
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
        instructions: instructions,
        image: character.image,
        greeting: character.greeting,
      },
    });

    await ctx.deleteMessage(waitMessage.message_id);
    await ctx.replyWithHTML(ctx.t("asst:html.imported"));
    await ctx.scene.enter("assistantScene", undefined, true);

    const isAdmin = (
      process.env.BOT_ADMINS?.split(",").map(Number) ?? []
    ).includes(ctx.message!.from.id);

    const keyboard = new InlineKeyboard()
      .row(
        InlineKeyboard.text(
          ctx.t("asst:btn.name"),
          `asst.${assistant.id}.name`
        ),
        InlineKeyboard.text(ctx.t("asst:btn.inst"), `asst.${assistant.id}.inst`)
      )
      .text(ctx.t("asst:btn.greeting"), `asst.${assistant.id}.greeting`)
      .text(ctx.t("asst:btn.conv.new"), `asst.${assistant.id}.chat`)
      .text(ctx.t("asst:btn.codeinterpreter"), `asst.${assistant.id}.code`)
      .text(ctx.t("asst:btn.rss"), `asst.${assistant.id}.rss`)
      .text(ctx.t("asst:btn.weather"), `asst.${assistant.id}.weather`)
      .text(ctx.t("asst:btn.google"), `asst.${assistant.id}.google`)
      .text(
        ctx.t("asst:btn.public.on"),
        `asst.${assistant.id}.public.on`,
        !isAdmin
      )
      .switchToChat(ctx.t("asst:btn.share"), assistant.name)
      .text(ctx.t("btn.delete"), `asst.${assistant.id}.del`)
      .text(ctx.t("asst:btn.back.assts"), "asst.back");

    const response = ctx.t("asst:html.asst", {
      assistant: assistant.name,
      instructions:
        (assistant.instructions || "").length > 3072
          ? ctx.t("asst:html.inst.toolong")
          : assistant.instructions
              ?.replace(/{{user}}/gi, ctx.message?.from.first_name ?? "User")
              .replace(/{user}/gi, ctx.message?.from.first_name ?? "User")
              .replace(/{{char}}/gi, assistant.name)
              .replace(/{char}/gi, assistant.name),
      greeting:
        (assistant.greeting || "").length > 512
          ? ctx.t("asst:html.greeting.toolong")
          : assistant.greeting
              ?.replace(/{{user}}/gi, ctx.message?.from.first_name ?? "User")
              .replace(/{user}/gi, ctx.message?.from.first_name ?? "User")
              .replace(/{{char}}/gi, assistant.name)
              .replace(/{char}/gi, assistant.name),
    });

    try {
      await ctx.replyWithPhoto(
        assistant.image ?? Constants.thumbnail(assistant.name),
        {
          caption: response,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }
      );
    } catch {
      try {
        await ctx.replyWithPhoto(Constants.thumbnail(assistant.name), {
          caption: response,
          parse_mode: "HTML",
          reply_markup: keyboard,
        });
      } catch {
        try {
          await ctx.replyWithPhoto(
            assistant.image ?? Constants.thumbnail(assistant.name),
            {
              caption: `🖼️ <b>${assistant.name}</b>`,
              parse_mode: "HTML",
            }
          );
        } catch {
          await ctx.replyWithPhoto(Constants.thumbnail(assistant.name), {
            caption: `🖼️ <b>${assistant.name}</b>`,
            parse_mode: "HTML",
          });
        }
        try {
          await ctx.replyWithHTML(response, { reply_markup: keyboard });
        } catch {
          await ctx.replyWithHTML(
            ctx.t("asst:html.asst", {
              assistant: assistant.name,
              instructions: ctx.t("asst:html.inst.toolong"),
              greeting: ctx.t("asst:html.greeting.toolong"),
            }),
            { reply_markup: keyboard }
          );
        }
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
