import { SceneSessionData } from "telegraf/typings/scenes";

interface BotSceneSession extends SceneSessionData {
  step?: number;
  conversationId?: string;
}

export default BotSceneSession;
