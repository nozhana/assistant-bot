import { Scenes, session, Telegraf } from "telegraf";
import { SQLite } from "@telegraf/session/sqlite";

import BotContext from "./middlewares/bot-context";
import SessionData, { defaultSession } from "./middlewares/session-data";
import helpHandler from "./handlers/help-handler";
import chatScene from "./scenes/chat-scene";
import convScene from "./scenes/conv-scene";
import settingsScene from "./scenes/settings-scene";
import newAssistantScene from "./scenes/new-assistant-scene";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);
const store = SQLite<SessionData>({
  filename: "./telegraf-sessions.sqlite",
});
bot.use(session({ defaultSession, store }));

bot.use((ctx, next) => {
  ctx.prisma = new PrismaClient();
  ctx.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return next();
});

const stage = new Scenes.Stage([
  chatScene,
  convScene,
  settingsScene,
  newAssistantScene,
]);
bot.use(stage.middleware());

bot.start(helpHandler);
bot.help(helpHandler);
bot.settings((ctx) => ctx.scene.enter("settingsScene"));
bot.command("chat", (ctx) => ctx.scene.enter("convScene"));

export default bot;
