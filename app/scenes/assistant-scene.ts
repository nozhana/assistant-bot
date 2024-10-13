import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { AssistantTool } from "openai/resources/beta/assistants";
import InlineKeyboard from "../util/inline-keyboard";
import initializeUserAndPersonalAssistant from "../handlers/init-user";
import Constants, { GoogleTool, RssTool, WeatherTool } from "../util/constants";

const assistantScene = new Scenes.BaseScene<BotContext>("assistantScene");

assistantScene.enter(async (ctx) => {
  await initializeUserAndPersonalAssistant(ctx);
  return listAssistants(ctx);
});

const listAssistants = async (ctx: BotContext, page: number = 1) => {
  const { prisma } = ctx;
  if (!ctx.from) return ctx.scene.leave();

  const assistants = await prisma.assistant.findMany({
    skip: (page - 1) * 10,
    take: 10,
    where: {
      OR: [
        { userId: ctx.from.id },
        { guestIds: { has: ctx.from.id } },
        { public: true },
      ],
    },
  });

  const assistantsCount = await prisma.assistant.count({
    where: {
      OR: [
        { userId: ctx.from.id },
        { guestIds: { has: ctx.from.id } },
        { public: true },
      ],
    },
  });

  const pages = Math.ceil(assistantsCount / 10);

  const keyboard = new InlineKeyboard()
    .row(
      InlineKeyboard.text(ctx.t("asst:btn.new"), "asst.new"),
      InlineKeyboard.text(ctx.t("asst:btn.import"), "asst.import")
    )
    .rows(
      ...assistants.map((e) => [
        InlineKeyboard.text(`🤖 ${e.name}`, `asst.${e.id}`),
      ])
    )
    .row(
      InlineKeyboard.text(
        ctx.t("btn.prev", { page: page - 1 }),
        `asst.list.${page - 1}`,
        page <= 1
      ),
      InlineKeyboard.text(
        ctx.t("btn.next", { page: page + 1 }),
        `asst.list.${page + 1}`,
        page >= pages
      )
    );

  return ctx.replyWithHTML(ctx.t("asst:html.assts"), {
    reply_markup: keyboard,
  });
};

assistantScene.action("asst.back", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("asst:cb.assts"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.reenter();
});

assistantScene.action("asst.new", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("asst:cb.new"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("newAssistantScene");
});

assistantScene.action("asst.import", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("asst:cb.import"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("importAssistantScene");
});

assistantScene.action(/asst\.list\.(\d+)/g, async (ctx) => {
  const page = Number(ctx.match[1]);
  return listAssistants(ctx, page);
});

assistantScene.action(/asst\.([^.]+)\.del/g, async (ctx) => {
  const id = ctx.match[1];
  const { prisma, openai } = ctx;
  const isGuest = await prisma.user.count({
    where: {
      id: ctx.from.id,
      guestAssistantIds: { has: id },
      assistants: { none: { id } },
    },
  });

  if (isGuest) {
    await prisma.user.update({
      where: { id: ctx.from.id },
      data: { guestAssistants: { disconnect: { id } } },
    });
  } else {
    const deleted = await prisma.assistant.delete({ where: { id } });
    let remoteAsst;
    try {
      remoteAsst = await openai.beta.assistants.retrieve(deleted.serversideId);
    } catch (error) {
      console.log(error);
      return answerDeletedAndReturn();
    }
    const storeIds =
      remoteAsst.tool_resources?.file_search?.vector_store_ids ?? [];
    const fileSearchFileIds: string[] = [];

    for (let storeId of storeIds) {
      let vectorFiles;
      try {
        vectorFiles = await openai.beta.vectorStores.files.list(storeId);
      } catch (error) {
        console.log(error);
        continue;
      }
      for (let vectorFile of vectorFiles.data) {
        fileSearchFileIds.push(vectorFile.id);
      }
    }

    const fileIds = [
      ...(remoteAsst.tool_resources?.code_interpreter?.file_ids ?? []),
      ...fileSearchFileIds,
    ];

    for (let fileId of fileIds) {
      try {
        await openai.files.del(fileId);
      } catch (error) {
        console.log(error);
        continue;
      }
    }

    for (let storeId of storeIds) {
      try {
        await openai.beta.vectorStores.del(storeId);
      } catch (error) {
        console.log(error);
        continue;
      }
    }

    try {
      await openai.beta.assistants.del(deleted.serversideId);
    } catch (error) {
      console.log(error);
    }
  }

  async function answerDeletedAndReturn() {
    await ctx.answerCbQuery(ctx.t("asst:cb.deleted"), {
      show_alert: true,
    });
    await ctx.editMessageReplyMarkup(undefined);
    return ctx.scene.reenter();
  }

  return answerDeletedAndReturn();
});

assistantScene.action(/asst\.([^.]+)\.chat/g, async (ctx) => {
  const id = ctx.match[1];
  const { prisma } = ctx;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.from.id },
  });
  if (!user.balance || user.balance <= 0)
    return ctx.answerCbQuery(ctx.t("chat:cb.balance.low"), {
      show_alert: true,
    });
  const conversation = await prisma.conversation.create({
    data: { userId: ctx.from.id, assistantId: id },
  });

  await ctx.answerCbQuery(ctx.t("chat:cb.chatting"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("chatScene", { conversationId: conversation.id });
});

assistantScene.action(/asst\.([^.]+)\.name/g, async (ctx) => {
  const id = ctx.match[1];
  const { prisma } = ctx;
  ctx.scene.state = { id, edit: "name" };

  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });

  const keyboard = new InlineKeyboard().text(ctx.t("btn.back"), `asst.${id}`);

  await ctx.answerCbQuery(ctx.t("asst:cb.name"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(
    ctx.t("asst:html.asst.new.name", { name: assistant.name }),
    {
      reply_markup: keyboard,
    }
  );
});

assistantScene.action(/asst\.([^.]+)\.inst/g, async (ctx) => {
  const id = ctx.match[1];
  const { prisma } = ctx;
  ctx.scene.state = { id, edit: "instructions" };

  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });

  const keyboard = new InlineKeyboard().text(ctx.t("btn.back"), `asst.${id}`);

  await ctx.answerCbQuery(ctx.t("asst:cb.inst"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(
    ctx.t("asst:html.asst.new.inst", { instructions: assistant.instructions }),
    {
      reply_markup: keyboard,
    }
  );
});

assistantScene.action(/asst\.([^.]+)\.greeting\.del$/g, async (ctx) => {
  const id = ctx.match[1];
  const { prisma } = ctx;
  ctx.scene.state = {};

  const assistant = await prisma.assistant.update({
    where: { id },
    data: { greeting: null },
  });

  await ctx.answerCbQuery(
    ctx.t("asst:cb.greeting.del", { assistant: assistant.name }),
    { show_alert: true }
  );
  await ctx.editMessageReplyMarkup(undefined);
  return assistantDetails(ctx, id);
});

assistantScene.action(/asst\.([^.]+)\.greeting$/g, async (ctx) => {
  const id = ctx.match[1];
  const { prisma } = ctx;
  ctx.scene.state = { id, edit: "greeting" };

  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });

  const keyboard = new InlineKeyboard().row(
    InlineKeyboard.text(ctx.t("btn.back"), `asst.${id}.reset`),
    InlineKeyboard.text(
      ctx.t("asst:btn.no.greeting"),
      `asst.${id}.greeting.del`,
      !assistant.greeting
    )
  );

  await ctx.answerCbQuery(ctx.t("asst:cb.greeting"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(
    ctx.t("asst:html.asst.new.greeting", { greeting: assistant.greeting }),
    {
      reply_markup: keyboard,
    }
  );
});

assistantScene.action(/^asst\.([^.]+)\.reset$/g, async (ctx) => {
  const id = ctx.match[1];
  ctx.scene.state = {};
  return assistantDetails(ctx, id);
});

assistantScene.hears(/^[^\/].*/g, async (ctx, next) => {
  const { openai, prisma } = ctx;
  const { id, edit } = ctx.scene.state as {
    id?: string;
    edit?: "name" | "instructions" | "greeting";
  };

  if (!id || !edit) return next();

  if (edit === "greeting") {
    if (ctx.text.length > 512)
      return ctx.replyWithHTML(ctx.t("asst:html.asst.new.greeting.toolong"));

    ctx.scene.state = {};
    await prisma.assistant.update({
      where: { id },
      data: { greeting: ctx.text },
    });
    return assistantDetails(ctx, id);
  }

  if (edit === "name" && ctx.text.length > 64)
    return ctx.replyWithHTML(ctx.t("asst:html.asst.new.name.toolong"));

  if (edit === "instructions" && ctx.text.length > 3072)
    return ctx.replyWithHTML(ctx.t("asst:html.asst.new.inst.toolong"));

  ctx.scene.state = {};

  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });

  await openai.beta.assistants.update(assistant.serversideId, {
    name: edit === "name" ? ctx.text : undefined,
    instructions:
      edit === "instructions"
        ? ctx.text
            .replace(/{{char}}/gi, assistant.name)
            .replace(/{char}/gi, assistant.name)
        : assistant.instructions
            ?.replace(/{{char}}/gi, assistant.name)
            .replace(/{char}/gi, assistant.name),
  });

  await prisma.assistant.update({
    where: { id },
    data: {
      name: edit === "name" ? ctx.text : undefined,
      instructions: edit === "instructions" ? ctx.text : undefined,
    },
  });

  return assistantDetails(ctx, id);
});

assistantScene.action(/asst\.([^.]+)\.files/g, async (ctx) => {
  const id = ctx.match[1];
  const { prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });
  await ctx.answerCbQuery(
    ctx.t("files:cb.files", { assistant: assistant.name })
  );
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("fileScene", { assistantId: id });
});

assistantScene.action(/asst\.([^.]+)\.code/g, async (ctx) => {
  const id = ctx.match[1];
  const { prisma, openai } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });
  const remoteAsst = await openai.beta.assistants.retrieve(
    assistant.serversideId
  );

  let tools: AssistantTool[];
  if (assistant.hasCode)
    tools = remoteAsst.tools.filter((v) => v.type !== "code_interpreter");
  else tools = [...remoteAsst.tools, { type: "code_interpreter" }];

  try {
    await openai.beta.assistants.update(assistant.serversideId, { tools });
    await ctx.answerCbQuery(
      ctx.t(
        assistant.hasCode
          ? "asst:cb.codeinterpreter.off"
          : "asst:cb.codeinterpreter.on",
        { assistant: remoteAsst.name }
      ),
      { show_alert: true }
    );
  } catch {
    await ctx.answerCbQuery(ctx.t("cb.error"), { show_alert: true });
  }

  await prisma.assistant.update({
    where: { id },
    data: { hasCode: !assistant.hasCode },
  });

  await ctx.deleteMessage();
  return assistantDetails(ctx, id);
});

assistantScene.action(/asst\.([^.]+)\.rss/g, async (ctx) => {
  const id = ctx.match[1];
  const { openai, prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });
  const remoteAsst = await openai.beta.assistants.retrieve(
    assistant.serversideId
  );

  let tools: AssistantTool[];
  if (assistant.hasRss)
    tools = remoteAsst.tools.filter(
      (v) =>
        (v.type === "function" && v.function.name !== "fetchRssFeed") ||
        v.type !== "function"
    );
  else tools = [...remoteAsst.tools, { ...RssTool }];

  try {
    await openai.beta.assistants.update(assistant.serversideId, { tools });
    await ctx.answerCbQuery(
      ctx.t(assistant.hasRss ? "asst:cb.rss.off" : "asst:cb.rss.on", {
        assistant: assistant.name,
      }),
      { show_alert: true }
    );
  } catch {
    await ctx.answerCbQuery(ctx.t("cb.error"), { show_alert: true });
  }

  await prisma.assistant.update({
    where: { id },
    data: { hasRss: !assistant.hasRss },
  });

  await ctx.deleteMessage();
  return assistantDetails(ctx, id);
});

assistantScene.action(/asst\.([^.]+)\.weather/g, async (ctx) => {
  const id = ctx.match[1];
  const { openai, prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });
  const remoteAsst = await openai.beta.assistants.retrieve(
    assistant.serversideId
  );

  let tools: AssistantTool[];
  if (assistant.hasWeather)
    tools = remoteAsst.tools.filter(
      (v) =>
        (v.type === "function" && v.function.name !== "fetchWeather") ||
        v.type !== "function"
    );
  else tools = [...remoteAsst.tools, { ...WeatherTool }];

  try {
    await openai.beta.assistants.update(assistant.serversideId, { tools });
    await ctx.answerCbQuery(
      ctx.t(
        assistant.hasWeather ? "asst:cb.weather.off" : "asst:cb.weather.on",
        {
          assistant: assistant.name,
        }
      ),
      { show_alert: true }
    );
  } catch {
    await ctx.answerCbQuery(ctx.t("cb.error"), { show_alert: true });
  }

  await prisma.assistant.update({
    where: { id },
    data: { hasWeather: !assistant.hasWeather },
  });

  await ctx.deleteMessage();
  return assistantDetails(ctx, id);
});

assistantScene.action(/asst\.([^.]+)\.google/g, async (ctx) => {
  const id = ctx.match[1];
  const { openai, prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });
  const remoteAsst = await openai.beta.assistants.retrieve(
    assistant.serversideId
  );

  let tools: AssistantTool[];
  if (assistant.hasGoogle)
    tools = remoteAsst.tools.filter(
      (v) =>
        (v.type === "function" && v.function.name !== "fetchGoogleResults") ||
        v.type !== "function"
    );
  else tools = [...remoteAsst.tools, { ...GoogleTool }];

  try {
    await openai.beta.assistants.update(assistant.serversideId, { tools });
    await ctx.answerCbQuery(
      ctx.t(assistant.hasGoogle ? "asst:cb.google.off" : "asst:cb.google.on", {
        assistant: assistant.name,
      }),
      { show_alert: true }
    );
  } catch {
    await ctx.answerCbQuery(ctx.t("cb.error"), { show_alert: true });
  }

  await prisma.assistant.update({
    where: { id },
    data: { hasGoogle: !assistant.hasGoogle },
  });

  await ctx.deleteMessage();
  return assistantDetails(ctx, id);
});

assistantScene.action(/asst\.([^.]+)\.public\.(off|on)/g, async (ctx) => {
  const { prisma } = ctx;
  const id = ctx.match[1];
  const isOn = ctx.match[2] === "on";
  const assistant = await prisma.assistant.update({
    where: { id },
    data: { public: isOn },
  });
  await ctx.answerCbQuery(
    ctx.t(isOn ? "asst:cb.public.on" : "asst:cb.public.off", {
      assistant: assistant.name,
    }),
    { show_alert: true }
  );
  await ctx.deleteMessage();
  return assistantDetails(ctx, id);
});

assistantScene.action(/asst\.([^.]+)\.revoke$/g, async (ctx) => {
  const { prisma } = ctx;
  const id = ctx.match[1];
  const assistant = await prisma.assistant.findUniqueOrThrow({
    where: { id },
    include: { guests: true },
  });

  const keyboard = new InlineKeyboard()
    .rows(
      ...assistant.guests.map((guest) => [
        InlineKeyboard.text(guest.firstName, `asst.${id}.revoke.${guest.id}`),
      ])
    )
    .row(
      InlineKeyboard.text(ctx.t("btn.back"), `asst.${id}`),
      InlineKeyboard.text(
        ctx.t("asst:btn.revoke.all"),
        `asst.${id}.revoke.all`,
        !assistant.guests.length
      )
    );

  await ctx.answerCbQuery(ctx.t("asst:cb.revoke"));
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.replyWithHTML(
    ctx.t("asst:html.revoke", { assistant: assistant.name }),
    { reply_markup: keyboard }
  );
});

assistantScene.action(/asst\.([^.]+)\.revoke\.(\d+)$/g, async (ctx) => {
  const { prisma } = ctx;
  const id = ctx.match[1];
  const userId = Number(ctx.match[2]);

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const assistant = await prisma.assistant.update({
    where: { id },
    data: { guests: { disconnect: { id: userId } } },
    include: { guests: true },
  });

  const keyboard = new InlineKeyboard()
    .rows(
      ...assistant.guests.map((guest) => [
        InlineKeyboard.text(guest.firstName, `asst.${id}.revoke.${guest.id}`),
      ])
    )
    .row(
      InlineKeyboard.text(ctx.t("btn.back"), `asst.${id}`),
      InlineKeyboard.text(
        ctx.t("asst:btn.revoke.all"),
        `asst.${id}.revoke.all`,
        !assistant.guests.length
      )
    );

  await ctx.answerCbQuery(
    ctx.t("asst:cb.revoke.user", { user: user.firstName }),
    {
      show_alert: true,
    }
  );
  return ctx.editMessageReplyMarkup(keyboard);
});

assistantScene.action(/asst\.([^.]+)\.revoke.all$/g, async (ctx) => {
  const { prisma } = ctx;
  const id = ctx.match[1];

  const assistant = await prisma.assistant.update({
    where: { id },
    data: { guests: { set: [] } },
  });

  await ctx.answerCbQuery(
    ctx.t("asst:cb.revoke.all", { assistant: assistant.name }),
    { show_alert: true }
  );
  await ctx.deleteMessage();

  return assistantDetails(ctx, id);
});

assistantScene.action(/asst\.([^.]+)$/g, async (ctx) => {
  const { prisma } = ctx;
  const id = ctx.match[1];
  if (!id) return ctx.scene.reenter();

  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });

  await ctx.answerCbQuery(`🤖 ${assistant.name}`);
  await ctx.editMessageReplyMarkup(undefined);

  return assistantDetails(ctx, id);
});

export async function assistantDetails(ctx: BotContext, id: string) {
  const { prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({
    where: { id },
    include: { files: true },
  });

  const isCreator = assistant.userId === ctx.from?.id;
  const isGuest = assistant.guestIds.includes(ctx.from?.id ?? 0);
  const isAdmin = (
    process.env.BOT_ADMINS?.split(",").map(Number) ?? []
  ).includes(ctx.from!.id);

  const isPersonalAssistant =
    assistant.name.toLowerCase() === "personal assistant";

  const keyboard = new InlineKeyboard()
    .row(
      InlineKeyboard.text(
        ctx.t("asst:btn.name"),
        `asst.${assistant.id}.name`,
        isGuest || isPersonalAssistant || (assistant.public && !isCreator)
      ),
      InlineKeyboard.text(
        ctx.t("asst:btn.inst"),
        `asst.${assistant.id}.inst`,
        isGuest || isPersonalAssistant || (assistant.public && !isCreator)
      )
    )
    .text(
      ctx.t("asst:btn.greeting"),
      `asst.${assistant.id}.greeting`,
      isGuest || isPersonalAssistant || (assistant.public && !isCreator)
    )
    .text(ctx.t("asst:btn.conv.new"), `asst.${assistant.id}.chat`)
    .text(ctx.t("asst:btn.files"), `asst.${assistant.id}.files`, !isCreator)
    .text(
      (assistant.hasCode ? "✅ " : "") + ctx.t("asst:btn.codeinterpreter"),
      `asst.${assistant.id}.code`,
      isGuest || (assistant.public && !isCreator)
    )
    .text(
      (assistant.hasRss ? "✅ " : "") + ctx.t("asst:btn.rss"),
      `asst.${assistant.id}.rss`,
      isGuest || (assistant.public && !isCreator)
    )
    .row(
      InlineKeyboard.text(
        (assistant.hasWeather ? "✅ " : "") + ctx.t("asst:btn.weather"),
        `asst.${assistant.id}.weather`,
        isGuest || (assistant.public && !isCreator)
      ),
      InlineKeyboard.text(
        (assistant.hasGoogle ? "✅ " : "") + ctx.t("asst:btn.google"),
        `asst.${assistant.id}.google`,
        isGuest || (assistant.public && !isCreator)
      )
    )
    .text(
      assistant.public
        ? ctx.t("asst:btn.public.off")
        : ctx.t("asst:btn.public.on"),
      `asst.${assistant.id}.public.` + (assistant.public ? "off" : "on"),
      isGuest || isPersonalAssistant || !isAdmin || !isCreator
    )
    .switchToChat(
      ctx.t("asst:btn.share"),
      assistant.name,
      isGuest || isPersonalAssistant || assistant.public
    )
    .text(
      ctx.t("asst:btn.revoke"),
      `asst.${assistant.id}.revoke`,
      !isCreator || !assistant.guestIds.length
    )
    .text(
      ctx.t("btn.delete"),
      `asst.${assistant.id}.del`,
      isPersonalAssistant || (assistant.public && !isCreator)
    )
    .text(ctx.t("asst:btn.back.assts"), "asst.back");

  let response: string = ctx.t("asst:html.asst", {
    assistant: assistant.name,
    instructions:
      (assistant.instructions || "").length > 3072
        ? ctx.t("asst:html.inst.toolong")
        : assistant.instructions
            ?.replace(/{{user}}/gi, ctx.from?.first_name ?? "User")
            .replace(/{user}/gi, ctx.from?.first_name ?? "User")
            .replace(/{{char}}/gi, assistant.name)
            .replace(/{char}/gi, assistant.name),
    greeting:
      (assistant.greeting || "").length > 512
        ? ctx.t("asst:html.greeting.toolong")
        : assistant.greeting
            ?.replace(/{{user}}/gi, ctx.from?.first_name ?? "User")
            .replace(/{user}/gi, ctx.from?.first_name ?? "User")
            .replace(/{{char}}/gi, assistant.name)
            .replace(/{char}/gi, assistant.name),
  });

  if (isCreator && assistant.guestIds.length)
    response +=
      "\n\n" +
      ctx.t("asst:html.asst.shared", { count: assistant.guestIds.length });

  try {
    await ctx.replyWithPhoto(
      assistant.image ?? Constants.thumbnail(assistant.name),
      {
        caption: response,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }
    );
  } catch {
    try {
      await ctx.replyWithPhoto(Constants.thumbnail(assistant.name), {
        caption: response,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch {
      try {
        await ctx.replyWithPhoto(
          assistant.image ?? Constants.thumbnail(assistant.name),
          {
            caption: `🖼️ <b>${assistant.name}</b>`,
            parse_mode: "HTML",
          }
        );
      } catch {
        await ctx.replyWithPhoto(Constants.thumbnail(assistant.name), {
          caption: `🖼️ <b>${assistant.name}</b>`,
          parse_mode: "HTML",
        });
      }
      try {
        await ctx.replyWithHTML(response, { reply_markup: keyboard });
      } catch {
        response = ctx.t("asst:html.asst", {
          assistant: assistant.name,
          instructions: ctx.t("asst:html.inst.toolong"),
          greeting: ctx.t("asst:html.greeting.toolong"),
        });
        if (isCreator && assistant.guestIds.length)
          response +=
            "\n\n" +
            ctx.t("asst:html.asst.shared", {
              count: assistant.guestIds.length,
            });
        await ctx.replyWithHTML(response, { reply_markup: keyboard });
      }
    }
  }
}

export default assistantScene;
