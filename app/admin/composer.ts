import { Composer, Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import adminMenuScene from "./scenes/admin-menu-scene";

const adminBot = new Composer<BotContext>();

const stage = new Scenes.Stage([adminMenuScene]);
adminBot.use(stage.middleware());

adminBot.command("admin", (ctx) => ctx.scene.enter("adminMenuScene"));
adminBot.action("admin.menu", (ctx) => {
  ctx.answerCbQuery(ctx.t("admin:cb.menu"));
  ctx.editMessageReplyMarkup(undefined);
  ctx.scene.enter("adminMenuScene");
});

export default adminBot;
