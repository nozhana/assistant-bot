import { NarrowedContext } from "telegraf";
import { SceneContextScene } from "telegraf/typings/scenes";
import {
  Update,
  Message,
  CallbackQuery,
} from "telegraf/typings/core/types/typegram";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";

import BotSceneSession from "./scene-session";
import SessionData from "./session-data";
import { I18nContext } from "./i18n-middleware";

interface BotContext extends I18nContext {
  session: SessionData;
  scene: SceneContextScene<BotContext, BotSceneSession>;
  prisma: PrismaClient;
  openai: OpenAI;
}

export default BotContext;

export type TextMessageBotContext = NarrowedContext<
  BotContext,
  {
    message: Update.New & Update.NonChannel & Message.TextMessage;
    update_id: number;
  }
>;

export type CallbackDataQueryBotContext = NarrowedContext<
  BotContext,
  {
    callback_query: Update.CallbackQueryUpdate & CallbackQuery.DataQuery;
    update_id: number;
  }
>;
