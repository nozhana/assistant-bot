import { PrismaClient } from "@prisma/client";
import prismaMiddleware from "./prisma-middleware";
import OpenAI from "openai";
import openaiMiddleware from "./openai-middleware";
import { SceneSession } from "telegraf/typings/scenes";
import BotSceneSession from "./scene-session";

interface SessionData extends SceneSession<BotSceneSession> {
  prisma: PrismaClient;
  openai: OpenAI;
  settings: SessionSettings;
}

export const defaultSession: () => SessionData = () => ({
  ...prismaMiddleware(),
  ...openaiMiddleware(),
  settings: {
    isVoiceResponse: true,
    voice: "alloy",
    language: "en-US",
  },
});

export default SessionData;
