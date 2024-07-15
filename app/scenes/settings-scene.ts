import { Scenes } from "telegraf";

import BotContext from "../middlewares/bot-context";
import InlineKeyboard from "../util/inline-keyboard";
import { languages } from "../middlewares/i18n-middleware";
import capitalize from "../util/capitalize";

const settingsScene = new Scenes.BaseScene<BotContext>("settingsScene");

settingsScene.enter(async (ctx) => {
  const admins = process.env.BOT_ADMINS?.split(",").map(Number) ?? [];

  const keyboard = new InlineKeyboard()
    .text(
      ctx.t(
        ctx.session.settings.isVoiceResponse
          ? "settings:btn.response.text"
          : "settings:btn.response.voice"
      ),
      `settings.vc.${ctx.session.settings.isVoiceResponse ? "off" : "on"}`
    )
    .text(ctx.t("settings:btn.voice"), "settings.vc.change")
    .text(
      ctx.i18n.language === "en"
        ? "🇺🇸 English"
        : ctx.i18n.language === "de"
        ? "🇩🇪 Deutsch"
        : "🇮🇷 فارسی",
      "settings.lang"
    )
    .text(
      ctx.t("admin:btn.menu"),
      "admin.menu",
      !(ctx.from && admins.includes(ctx.from.id))
    );

  return ctx.replyWithHTML(ctx.t("settings:html.settings"), {
    reply_markup: keyboard,
  });
});

settingsScene.action("settings.back", async (ctx) => {
  await ctx.answerCbQuery("⚙️ Settings");
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

settingsScene.action("settings.vc.off", async (ctx) => {
  ctx.session.settings.isVoiceResponse = false;
  await ctx.answerCbQuery(ctx.t("settings:cb.response.text"), {
    show_alert: true,
  });
  await ctx.deleteMessage();
  return ctx.scene.reenter();
});

settingsScene.action("settings.vc.on", async (ctx) => {
  ctx.session.settings.isVoiceResponse = true;
  await ctx.answerCbQuery(ctx.t("settings:cb.response.voice"), {
    show_alert: true,
  });
  await ctx.deleteMessage();
  return ctx.scene.reenter();
});

settingsScene.action("settings.vc.change", async (ctx) => {
  const keyboard = new InlineKeyboard();

  const voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

  for (let index = 0; index < voices.length; index += 2) {
    const element = voices[index];
    const nextElement = (index < voices.length - 1 && voices[index + 1]) || "";

    keyboard.row(
      InlineKeyboard.text(
        ctx.session.settings.voice === element
          ? `✅ ${capitalize(element)}`
          : capitalize(element),
        `settings.vc.${element}`
      ),
      InlineKeyboard.text(
        ctx.session.settings.voice === nextElement
          ? `✅ ${capitalize(nextElement)}`
          : capitalize(nextElement),
        `settings.vc.${nextElement}`,
        !nextElement
      )
    );
  }

  keyboard.text(ctx.t("btn.back"), "settings.back");

  await ctx.answerCbQuery(ctx.t("settings:cb.voice"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(
    ctx.t("settings:html.voice", {
      voice: capitalize(ctx.session.settings.voice),
    }),
    { reply_markup: keyboard }
  );
});

settingsScene.action(
  /settings\.vc\.(alloy|echo|fable|onyx|nova|shimmer)/g,
  async (ctx) => {
    const voice = ctx.match[0].split(".").pop();
    if (!voice) return ctx.answerCbQuery();
    ctx.session.settings.voice = voice as
      | "alloy"
      | "echo"
      | "fable"
      | "onyx"
      | "nova"
      | "shimmer";

    ctx.answerCbQuery(
      ctx.t("settings:cb.voice.changed", { voice: capitalize(voice) }),
      {
        show_alert: true,
      }
    );
    ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.reenter();
  }
);

settingsScene.action("settings.lang", async (ctx) => {
  const languageKeys: { [key: string]: string } = {
    en: "🇬🇧 English",
    de: "🇩🇪 Deutsch",
    fa: "🇮🇷 فارسی",
  };

  const keyboard = new InlineKeyboard()
    .row(
      ...languages
        .filter((e) => e !== ctx.i18n.language)
        .map((e) => InlineKeyboard.text(languageKeys[e], `settings.lang.${e}`))
    )
    .text(ctx.t("btn.back"), "settings.back");

  await ctx.answerCbQuery(ctx.t("settings:cb.lang.change"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(ctx.t("settings:html.lang.change"), {
    reply_markup: keyboard,
  });
});

settingsScene.action(/settings\.lang\.(en|de|fa)/g, async (ctx) => {
  const lang = ctx.match[0].split(".").pop() as "en" | "de" | "fa";
  ctx.session.settings.locale = lang;
  const t = await ctx.i18n.changeLanguage(lang);
  await ctx.answerCbQuery(t("lang.feedback"), { show_alert: true });
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

settingsScene.action(/settings\..+/g, async (ctx) => {
  return ctx.answerCbQuery(ctx.t("coming.soon"), { show_alert: true });
});

export default settingsScene;
