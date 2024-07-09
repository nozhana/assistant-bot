import BotContext from "../middlewares/bot-context";

const voiceHandler = async (ctx: BotContext) => {
  const { isVoiceResponse } = ctx.session;
  if (isVoiceResponse) {
    ctx.session.isVoiceResponse = false;
    return ctx.reply("Voice response turned off.");
  } else {
    ctx.session.isVoiceResponse = true;
    return ctx.reply("Voice response turned on.");
  }
};

export default voiceHandler;
