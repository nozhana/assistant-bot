import { Context, NarrowedContext } from "telegraf";
import SessionData from "./session-data";
import { SceneContextScene } from "telegraf/typings/scenes";
import {
  Update,
  Message,
  CallbackQuery,
} from "telegraf/typings/core/types/typegram";

interface BotContext extends Context {
  session: SessionData;
  scene: SceneContextScene<BotContext>;
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
  Update.CallbackQueryUpdate<CallbackQuery.DataQuery>
>;
