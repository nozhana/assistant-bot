import { Scenes } from "telegraf";
import BotContext from "../../middlewares/bot-context";
import InlineKeyboard from "../../util/inline-keyboard";
import { message } from "telegraf/filters";
import sleep from "../../util/sleep";

const adminBroadcastScene = new Scenes.BaseScene<BotContext>(
  "adminBroadcastScene"
);

adminBroadcastScene.enter(async (ctx) => {
  const keyboard = new InlineKeyboard().text(ctx.t("btn.back"), "admin.back");
  return ctx.replyWithHTML(ctx.t("admin:html.broadcast"), {
    reply_markup: keyboard,
  });
});

adminBroadcastScene.on(message(), async (ctx, next) => {
  if (ctx.text?.startsWith("/")) return next();
  ctx.scene.state = { broadcastMsgId: ctx.message.message_id };

  const keyboard = new InlineKeyboard().row(
    InlineKeyboard.text(ctx.t("btn.confirm"), "admin.broadcast.confirm"),
    InlineKeyboard.text(ctx.t("btn.cancel"), "admin.broadcast.cancel")
  );

  return ctx.replyWithHTML(ctx.t("admin:html.broadcast.confirm"), {
    reply_markup: keyboard,
  });
});

adminBroadcastScene.action("admin.broadcast.confirm", async (ctx) => {
  const { prisma } = ctx;
  const { broadcastMsgId } = ctx.scene.state as {
    broadcastMsgId: number | undefined;
  };
  if (!broadcastMsgId) return ctx.answerCbQuery();

  const users = await prisma.user.findMany({
    where: { id: { not: ctx.from.id } },
  });

  const waitMessage = await ctx.replyWithHTML(ctx.t("html.wait"));

  for (let user of users) {
    try {
      await ctx.telegram.copyMessage(user.id, ctx.from.id, broadcastMsgId);
    } catch {
      await sleep(2000);
      try {
        await ctx.telegram.copyMessage(user.id, ctx.from.id, broadcastMsgId);
      } catch (error) {
        try {
          await ctx.replyWithHTML(
            ctx.t("admin:html.broadcast.failed.user", {
              user: user.firstName,
              userId: user.id,
            })
          );
        } catch {}
      }
    }
    await sleep(250);
  }

  const keyboard = new InlineKeyboard().text(ctx.t("btn.back"), "admin.back");

  await ctx.deleteMessage(waitMessage.message_id);
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(ctx.t("admin:html.broadcast.done"), {
    reply_markup: keyboard,
  });
});

adminBroadcastScene.action("admin.broadcast.cancel", async (ctx) => {
  ctx.state.broadcastMsgId = null;
  await ctx.answerCbQuery(ctx.t("cb.cancelled"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("adminMenuScene");
});

adminBroadcastScene.action("admin.back", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("admin:cb.menu"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("adminMenuScene");
});

export default adminBroadcastScene;
