import { Composer } from "telegraf";
import BotContext from "../middlewares/bot-context";
import cron from "node-cron";
import helpHandler from "./help-handler";
import { plans } from "../entities/plan";

const startHandler = new Composer<BotContext>();

startHandler.start(async (ctx) => {
  const { prisma } = ctx;
  const [id, planIndex] = ctx.payload.split(".").map(Number);
  const plan = plans[planIndex];
  const tasks = cron.getTasks();
  if (!tasks.has(ctx.payload)) return helpHandler(ctx);

  const invoices = await ctx.pay.getInvoices({ status: "paid", count: 10 });
  for (const item of invoices.items) {
    if (item.payload !== ctx.payload) continue;
    const task = tasks.get(item.payload);
    task?.stop();
    const user = await prisma.user.update({
      where: { id: ctx.from.id },
      data: { balance: { increment: plan.tokens } },
    });

    await ctx.replyWithHTML(
      ctx.t("wallet:html.topup.success", {
        count: plan.tokens,
        price: plan.priceUSD,
        balance: user.balance,
      })
    );
  }
});

export default startHandler;
