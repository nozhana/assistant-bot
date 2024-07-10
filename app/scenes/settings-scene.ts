import { Scenes } from "telegraf";

import BotContext from "../middlewares/bot-context";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";
import { callbackQuery } from "telegraf/filters";

const settingsScene = new Scenes.BaseScene<BotContext>("settingsScene");

settingsScene.enter(async (ctx) => {
  const buttons: InlineKeyboardButton[][] = [];

  buttons.push([
    {
      text: ctx.session.settings.isVoiceResponse
        ? "💬 Switch to text response"
        : "🔈 Switch to voice response",
      callback_data:
        "settings.vc." + (ctx.session.settings.isVoiceResponse ? "off" : "on"),
    },
  ]);

  buttons.push([
    {
      text: "🗣️ Change voice",
      callback_data: "settings.vc.change",
    },
  ]);

  buttons.push([
    {
      text:
        ctx.session.settings.language === "en-US"
          ? "🇺🇸 English (US)"
          : ctx.session.settings.language === "de"
          ? "🇩🇪 Deutsch"
          : "🇮🇷 فارسی",
      callback_data: "settings.lang.change",
    },
  ]);

  return ctx.replyWithHTML("⚙️ <b>Settings</b>", {
    reply_markup: { inline_keyboard: buttons },
  });
});

settingsScene.use(async (ctx, next) => {
  if (ctx.text?.startsWith("/")) {
    await ctx.scene.leave();
  }
  return next();
});

settingsScene.on(callbackQuery("data"), async (ctx, next) => {
  const data = ctx.callbackQuery.data.split(".");
  if (data[0] !== "settings") return next();

  switch (data[1]) {
    case "vc":
      switch (data[2]) {
        case "off":
          ctx.session.settings.isVoiceResponse = false;
          await ctx.answerCbQuery("💬 Switched to text response.", {
            show_alert: true,
          });
          await ctx.deleteMessage();
          return ctx.scene.reenter();
        case "on":
          ctx.session.settings.isVoiceResponse = true;
          await ctx.answerCbQuery("🔈 Switched to voice response.", {
            show_alert: true,
          });
          await ctx.deleteMessage();
          return ctx.scene.reenter();
        case "change":
          return voicesMenu();
        default:
          return setVoice(
            data[2] as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
          );
      }
      break;
    case "back":
      await ctx.answerCbQuery("⚙️ Settings");
      await ctx.editMessageReplyMarkup(undefined);
      return ctx.scene.reenter();
    default:
      await ctx.answerCbQuery("🛑 Not implemented", { show_alert: true });
      return ctx.scene.reenter();
  }

  async function voicesMenu() {
    const buttons: InlineKeyboardButton[][] = [];

    const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

    for (let index = 0; index < voices.length; index += 2) {
      const element = voices[index];
      const nextElement = index < voices.length - 1 && voices[index + 1];
      const row: InlineKeyboardButton[] = [];
      row.push({
        text:
          ctx.session.settings.voice === element ? `✅ ${element}` : element,
        callback_data: "settings.vc." + element,
      });
      if (nextElement)
        row.push({
          text:
            ctx.session.settings.voice === nextElement
              ? `✅ ${nextElement}`
              : nextElement,
          callback_data: "settings.vc." + nextElement,
        });

      buttons.push(row);
    }

    buttons.push([{ text: "👈 Back", callback_data: "settings.back" }]);

    await ctx.answerCbQuery("🗣️ Voices");
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.replyWithHTML(
      `🗣️ Selected voice: <b>${ctx.session.settings.voice}</b>`,
      { reply_markup: { inline_keyboard: buttons } }
    );
  }

  async function setVoice(
    voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
  ) {
    ctx.session.settings.voice = voice;
    ctx.answerCbQuery("🗣️ Voice changed to " + voice, { show_alert: true });
    ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.reenter();
  }
});

export default settingsScene;
