import { Context } from "telegraf";
import SessionData from "./session-data";
import { SceneContextScene } from "telegraf/typings/scenes";

interface BotContext extends Context {
  session: SessionData;
  scene: SceneContextScene<BotContext>;
}

export default BotContext;
