import bot from "./app/bot";

bot.launch(async () => {
  await bot.telegram.setMyCommands([
    { command: "help", description: "💁 List of commands" },
    { command: "chat", description: "💬 Talk to an assistant" },
    { command: "settings", description: "⚙️ Settings" },
  ]);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
