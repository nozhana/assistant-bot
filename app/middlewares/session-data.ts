import { SceneSession } from "telegraf/typings/scenes";
import BotSceneSession from "./scene-session";
import { CryptoPay } from "@foile/crypto-pay-api";

interface SessionData extends SceneSession<BotSceneSession> {
  pay?: CryptoPay;
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
