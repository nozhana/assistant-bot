import BotContext from "../middlewares/bot-context";
import escapeHtml from "../util/escape-html";
import initializeUserAndPersonalAssistant from "./init-user";

const helpHandler = async (ctx: BotContext) => {
  await initializeUserAndPersonalAssistant(ctx);

  await ctx.scene.leave();

  await ctx.replyWithHTML(
    ctx.t("html.help") +
      `\n\nv${escapeHtml(process.env.BOT_VERSION ?? "?.?.?")}`
  );
};

export default helpHandler;
