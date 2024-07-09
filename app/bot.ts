import { Scenes, session, Telegraf } from "telegraf";

import BotContext from "./middlewares/bot-context";
import { defaultSession } from "./middlewares/session-data";
import startHandler from "./handlers/start-handler";
import langHandler from "./handlers/lang-handler";
import chatHandler from "./handlers/chat-handler";
import voiceHandler from "./handlers/voice-handler";
import chatScene from "./scenes/chat-scene";
import { callbackQuery } from "telegraf/filters";
import convHandler from "./handlers/conv-handler";

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);

bot.use(session({ defaultSession }));

const stage = new Scenes.Stage([chatScene]);
bot.use(stage.middleware());

bot.start(startHandler);
bot.help(startHandler);
bot.command("chat", chatHandler);
bot.command("voice", voiceHandler);
bot.command("lang", langHandler);
bot.on(callbackQuery("data"), convHandler);

export default bot;
