import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import InlineKeyboard from "../util/inline-keyboard";
import { plans } from "../entities/plan";

const walletScene = new Scenes.BaseScene<BotContext>("walletScene");

walletScene.enter(async (ctx) => {
  const { prisma } = ctx;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.from?.id },
  });

  const keyboard = new InlineKeyboard().text(
    ctx.t("wallet:btn.topup"),
    "wallet.topup"
  );

  return ctx.replyWithHTML(
    ctx.t("wallet:html.wallet", { user: user.firstName, count: user.balance }),
    { reply_markup: keyboard }
  );
});

walletScene.action("wallet.back", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("wallet:cb.wallet"));
  await ctx.deleteMessage();
  return ctx.scene.reenter();
});

walletScene.action(/^wallet\.topup\.plan\.(\d+)$/g, async (ctx) => {
  // TODO: Topup
  return ctx.answerCbQuery("Coming soon!", { show_alert: true });
});

walletScene.action("wallet.topup", async (ctx) => {
  const keyboard = new InlineKeyboard()
    .rows(
      ...plans.map((plan, index) => [
        InlineKeyboard.text(
          `${plan.tokens} tokens - $${plan.priceUSD}`,
          `wallet.topup.plan.${index}`
        ),
      ])
    )
    .row(
      InlineKeyboard.text(ctx.t("btn.back"), "wallet.back"),
      InlineKeyboard.text(ctx.t("wallet:btn.gift"), "wallet.gift")
    );

  return ctx.replyWithHTML(ctx.t("wallet:html.gift"), {
    reply_markup: keyboard,
  });
});
