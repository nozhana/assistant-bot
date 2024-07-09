import { PrismaClient } from "@prisma/client";
import prismaMiddleware from "./prisma-middleware";
import OpenAI from "openai";
import openaiMiddleware from "./openai-middleware";
import { SceneSession } from "telegraf/typings/scenes";

interface SessionData extends SceneSession {
  prisma: PrismaClient;
  openai: OpenAI;
  isVoiceResponse: boolean;
  currentConversationId?: string;
}

export const defaultSession = () => ({
  ...prismaMiddleware(),
  ...openaiMiddleware(),
  isVoiceResponse: true,
});

export default SessionData;
