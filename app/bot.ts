import { Scenes, session, Telegraf } from "telegraf";

import BotContext from "./middlewares/bot-context";
import { defaultSession } from "./middlewares/session-data";
import helpHandler from "./handlers/help-handler";
import chatScene from "./scenes/chat-scene";
import convScene from "./scenes/conv-scene";
import settingsScene from "./scenes/settings-scene";
import newAssistantScene from "./scenes/new-assistant-scene";

const bot = new Telegraf<BotContext>(process.env.BOT_TOKEN!);

bot.use(session({ defaultSession }));

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
