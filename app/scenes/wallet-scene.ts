import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import InlineKeyboard from "../util/inline-keyboard";
import { plans } from "../entities/plan";
import { Assets, CryptoPay, PaidButtonNames } from "@foile/crypto-pay-api";
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
    await ctx.editMessageText(response, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });
  } catch {
    await ctx.replyWithHTML(response, { reply_markup: keyboard });
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
  const { prisma } = ctx;
  const planIndex = Number(ctx.match[1]);
  const plan = plans[planIndex];

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
    "* * * * *",
    async () => {
      const res = await ctx.pay.getInvoices({
        invoice_ids: createdInvoice.invoice_id,
      });
      const invoice = res.items[0];
      console.log("Updated invoice:");
      console.log(invoice);

      if (invoice.status !== "paid") return;

      task.stop();

      let user = await prisma.user.update({
        where: { id: ctx.from.id },
        data: { balance: { increment: plan.tokens } },
      });
      if (!user.balance) {
        user = await prisma.user.update({
          where: { id: ctx.from.id },
          data: { balance: plan.tokens },
        });
      }

      await ctx.replyWithHTML(
        ctx.t("wallet:html.topup.success", {
          count: plan.tokens,
          price: plan.priceUSD,
          balance: user.balance,
        })
      );
    },
    { scheduled: false, name: createdInvoice.payload }
  );

  task.start();

  const keyboard = new InlineKeyboard().row(
    InlineKeyboard.text(ctx.t("btn.back"), "wallet.back"),
    InlineKeyboard.url(
      ctx.t("wallet:btn.pay", { amount: plan.priceUSD }),
      createdInvoice.pay_url
    )
  );

  await ctx.answerCbQuery(ctx.t("wallet:cb.topup.pay"), {
    show_alert: true,
  });
  return ctx.editMessageText(
    ctx.t("wallet:html.topup.pay", {
      count: plan.tokens,
      price: plan.priceUSD,
    }),
    { reply_markup: keyboard, parse_mode: "HTML" }
  );
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
