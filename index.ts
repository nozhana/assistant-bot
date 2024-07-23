import bot from "./app/bot";

bot
  .launch(
    {
      webhook: process.env.WEBHOOK_URL
        ? {
            domain: process.env.WEBHOOK_URL,
            port: Number(process.env.WEBHOOK_PORT) || undefined,
            secretToken: process.env.WEBHOOK_TOKEN,
            cb: (req, res) =>
              console.log(`Request: ${req}\nResponse: ${res}\n\n`),
          }
        : undefined,
    },
    async () => {
      await bot.telegram.setMyCommands([
        { command: "help", description: "💁 List of commands" },
        { command: "chat", description: "💬 Talk to an assistant" },
        { command: "assistants", description: "🤖 Manage assistants" },
        { command: "settings", description: "⚙️ Settings" },
        { command: "wallet", description: "🐷 Wallet" },
      ]);
    }
  )
  .then(() => {
    if (process.env.WEBHOOK_URL)
      console.log(
        `Webhook listening on ${process.env.WEBHOOK_URL}:${process.env.WEBHOOK_PORT}`
      );
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
