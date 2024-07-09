import BotContext from "../middlewares/bot-context";

const langHandler = async (ctx: BotContext) => {
  await ctx.reply("Lang handler not implemented");
};

export default langHandler;
