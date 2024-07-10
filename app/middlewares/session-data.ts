import { SceneSession } from "telegraf/typings/scenes";
import BotSceneSession from "./scene-session";

interface SessionData extends SceneSession<BotSceneSession> {
  settings: SessionSettings;
}

export const defaultSession: () => SessionData = () => ({
  settings: {
    isVoiceResponse: true,
    voice: "alloy",
    language: "en-US",
  },
});

export default SessionData;
