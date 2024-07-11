import { Scenes } from "telegraf";
import BotContext from "../../middlewares/bot-context";
import { InlineKeyboardButton } from "telegraf/typings/core/types/typegram";

const adminMenuScene = new Scenes.BaseScene<BotContext>("adminMenuScene");

adminMenuScene.enter(async (ctx) => {
  const buttons: InlineKeyboardButton[][] = [];

  buttons.push([
    { text: "👥 Users", callback_data: "admin.users.1" },
    { text: "📣 Broadcast", callback_data: "admin.broadcast" },
  ]);

  return ctx.replyWithHTML("👑 <b>Admin menu</b>", {
    reply_markup: { inline_keyboard: buttons },
  });
});

adminMenuScene.action(/admin\.users\.(\d+)/g, async (ctx) => {
  const { prisma } = ctx;
  const page = Number(ctx.match[0].split(".").pop());
  const users = await prisma.user.findMany({ take: 10, skip: (page - 1) * 10 });
  const usersCount = await prisma.user.count();

  const buttons: InlineKeyboardButton[][] = [];

  for (let user of users) {
    buttons.push([
      {
        text: `👤 ${user.firstName} - ${user.id}`,
        callback_data: `admin.user.${user.id}`,
      },
    ]);
  }

  let navRow: InlineKeyboardButton[] = [];

  if (page > 1)
    navRow.push({
      text: `⬅️ Page ${page - 1}`,
      callback_data: `admin.users.${page - 1}`,
    });

  if (page * 10 < usersCount)
    navRow.push({
      text: `Page ${page + 1} ➡️`,
      callback_data: `admin.users.${page + 1}`,
    });

  if (navRow.length) buttons.push(navRow);

  buttons.push([{ text: "👈 Back", callback_data: "admin.reset" }]);

  await ctx.answerCbQuery(
    `👥 Users: ${page}/${(usersCount / 10).toFixed() + 1}`
  );
  return ctx.editMessageText(
    `👥 <b>Users</b> page(${page} of ${(usersCount / 10).toFixed() + 1})`,
    {
      reply_markup: { inline_keyboard: buttons },
      parse_mode: "HTML",
    }
  );
});

adminMenuScene.action(/admin\.user\.(.+)/g, async (ctx) => {
  const { prisma } = ctx;
  const userId = ctx.match[0].split(".").pop();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: Number(userId) },
    include: { conversations: true, assistants: true, messages: true },
  });

  await ctx.answerCbQuery(`👤 User ${user.id}`);
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(
    `👤 <b>User details</b>

🧑 Name: <code>${user.firstName}</code>
#️⃣ Telegram ID: <code>${user.id}</code>
💬 Conversations: <code>${user.conversations.length} conversations</code>
🤖 Assistants: <code>${user.assistants.length} assistants</code>

<a href="tg://user?id=${user.id}">🔗 Open user profile</a>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "👈 Back", callback_data: "admin.users.1" }],
        ],
      },
    }
  );
});

adminMenuScene.action("admin.reset", async (ctx) => {
  await ctx.answerCbQuery("👑 Admin menu");
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

export default adminMenuScene;
