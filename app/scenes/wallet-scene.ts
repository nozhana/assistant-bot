import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import InlineKeyboard from "../util/inline-keyboard";
import { plans } from "../entities/plan";
import { Assets, CryptoPay } from "@foile/crypto-pay-api";
import cron from "node-cron";

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

  const response = ctx.t("wallet:html.wallet", {
    user: user.firstName,
    count: user.balance,
  });

  try {
    try {
      await ctx.answerCbQuery(ctx.t("wallet:cb.wallet"));
    } catch {}
    return ctx.editMessageText(response, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch {
    return ctx.replyWithHTML(response, { reply_markup: keyboard });
  }
});

walletScene.action("wallet.back", async (ctx) => {
  return ctx.scene.reenter();
});

walletScene.action(/^wallet\.topup\.plan\.(\d+)$/g, async (ctx) => {
  const planIndex = Number(ctx.match[1]);
  const plan = plans[planIndex];

  const keyboard = new InlineKeyboard().row(
    InlineKeyboard.text(ctx.t("btn.back"), "wallet.back"),
    InlineKeyboard.text(
      ctx.t("wallet:btn.topup.continue"),
      `wallet.topup.continue.${planIndex}`
    )
  );

  await ctx.answerCbQuery(ctx.t("wallet:cb.topup.plan"));
  return ctx.editMessageText(
    ctx.t("wallet:html.topup.plan", {
      count: plan.tokens,
      price: plan.priceUSD,
    }),
    { reply_markup: keyboard, parse_mode: "HTML" }
  );
});

walletScene.action(/^wallet\.topup\.continue\.(\d+)$/g, async (ctx) => {
  const planIndex = Number(ctx.match[1]);
  const plan = plans[planIndex];

  const getMe = await ctx.pay.getMe();
  console.log("Get Me: ");
  console.log(getMe);

  const createdInvoice = await ctx.pay.createInvoice(
    Assets.USDT,
    String(plan.priceUSD),
    {
      description: "Testing 1,2,3",
      hidden_message: "You should only see this after payment.",
      expires_in: 1800,
      payload: `${ctx.from.id}.${planIndex}`,
    }
  );

  console.log("❇️ INVOICE CREATED:");
  console.log(createdInvoice);

  let task = cron.schedule(
    "*/2 * * * *",
    async () => {
      const invoices = await ctx.pay.getInvoices({
        invoice_ids: createdInvoice.invoice_id,
      });
      console.log("Updated invoice:");
      console.log(invoices);
    },
    { scheduled: false }
  );

  task.start();

  await ctx.answerCbQuery("Check console log.", {
    show_alert: true,
  });
  return ctx.scene.reenter();
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

  await ctx.answerCbQuery(ctx.t("wallet:cb.topup"));
  return ctx.editMessageText(ctx.t("wallet:html.topup"), {
    reply_markup: keyboard,
    parse_mode: "HTML",
  });
});

export default walletScene;
