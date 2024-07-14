import { SceneSession } from "telegraf/typings/scenes";
import BotSceneSession from "./scene-session";

interface SessionData extends SceneSession<BotSceneSession> {
  settings: SessionSettings;
}

export const defaultSession: () => SessionData = () => ({
  settings: {
    isVoiceResponse: true,
    voice: "alloy",
    locale: "en",
  },
});

export default SessionData;
