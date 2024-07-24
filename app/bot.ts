import { Composer, Scenes, session, Telegraf } from "telegraf";
import { SQLite } from "@telegraf/session/sqlite";

import BotContext from "./middlewares/bot-context";
import SessionData, { defaultSession } from "./middlewares/session-data";
import helpHandler from "./handlers/help-handler";
import chatScene from "./scenes/chat-scene";
import convScene from "./scenes/conv-scene";
import settingsScene from "./scenes/settings-scene";
import newAssistantScene from "./scenes/new-assistant-scene";
import assistantScene from "./scenes/assistant-scene";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import adminBot from "./admin/composer";
import asstInlineHandler from "./handlers/asst-inline-handler";
import asstGuestCallbackHandler from "./handlers/asst-guest-callback-handler";
import i18nMiddleware from "./middlewares/i18n-middleware";
import importAssistantScene from "./scenes/import-assistant-scene";
import fileScene from "./scenes/file-scene";
import walletScene from "./scenes/wallet-scene";
import { CryptoPay } from "@foile/crypto-pay-api";
import { readFileSync } from "fs";
import startHandler from "./handlers/start-handler";

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);
const store = SQLite<SessionData>({
  filename: "./telegraf-sessions.sqlite",
});
bot.use(session({ defaultSession, store }));

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const cryptopay = new CryptoPay(process.env.CRYPTOPAY_TOKEN!, {
  protocol: "https",
  hostname: "testnet-pay.crypt.bot",
});

bot.use((ctx, next) => {
  ctx.prisma ??= prisma;
  ctx.openai ??= openai;
  ctx.pay ??= cryptopay;
  return next();
});

bot.use(i18nMiddleware);
bot.use(async (ctx, next) => {
  if (!ctx.session) return next();
  await ctx.i18n.changeLanguage(ctx.session.settings.locale);
  return next();
});

const admins = process.env.BOT_ADMINS?.split(",").map(Number) ?? [];
bot.use(Composer.acl(admins, adminBot));

const stage = new Scenes.Stage([
  chatScene,
  convScene,
  settingsScene,
  assistantScene,
  newAssistantScene,
  importAssistantScene,
  fileScene,
  walletScene,
]);
bot.use(stage.middleware());

bot.start(startHandler.middleware());
bot.help(helpHandler);
bot.settings((ctx) => ctx.scene.enter("settingsScene"));
bot.command("chat", (ctx) => ctx.scene.enter("convScene"));
bot.command("assistants", (ctx) => ctx.scene.enter("assistantScene"));
bot.command("wallet", (ctx) => ctx.scene.enter("walletScene"));
bot.on("inline_query", asstInlineHandler);
bot.action(/guest\.([^.]+)/g, asstGuestCallbackHandler);

export default bot;
