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
      OR: [{ userId: ctx.from.id }, { guestIds: { has: ctx.from.id } }],
    },
  });

  const assistantsCount = await prisma.assistant.count({
    where: {
      OR: [{ userId: ctx.from.id }, { guestIds: { has: ctx.from.id } }],
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

assistantScene.action(/asst\.list\.\d+/g, async (ctx) => {
  const page = Number(ctx.match[0].split(".").pop());
  return listAssistants(ctx, page);
});

assistantScene.action(/asst\.[^.]+\.del/g, async (ctx) => {
  const id = ctx.match[0].split(".")[1];
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
  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });
  const conversation = await prisma.conversation.create({
    data: { userId: ctx.from.id, assistantId: id },
  });

  await ctx.answerCbQuery(ctx.t("chat:cb.chatting"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("chatScene", { conversationId: conversation.id });
});

assistantScene.action(/asst\.([^.]+)\.name/g, async (ctx) => {
  const id = ctx.match[1];
  ctx.scene.state = { id, edit: "name" };

  const keyboard = new InlineKeyboard().text(ctx.t("btn.back"), `asst.${id}`);

  await ctx.answerCbQuery(ctx.t("asst:cb.name"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(ctx.t("asst:html.asst.new.name"), {
    reply_markup: keyboard,
  });
});

assistantScene.action(/asst\.([^.]+)\.inst/g, async (ctx) => {
  const id = ctx.match[1];
  ctx.scene.state = { id, edit: "instructions" };

  const keyboard = new InlineKeyboard().text(ctx.t("btn.back"), `asst.${id}`);

  await ctx.answerCbQuery(ctx.t("asst:cb.inst"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithHTML(ctx.t("asst:html.asst.new.inst"), {
    reply_markup: keyboard,
  });
});

assistantScene.hears(/^[^\/].*/g, async (ctx, next) => {
  const { openai, prisma } = ctx;
  const { id, edit } = ctx.scene.state as {
    id?: string;
    edit?: "name" | "instructions";
  };

  if (!id || !edit) return next();

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

assistantScene.action(/asst\.[^.]+$/g, async (ctx) => {
  const { prisma } = ctx;
  const id = ctx.match[0].split(".").pop();
  if (!id) return ctx.scene.reenter();

  const assistant = await prisma.assistant.findUniqueOrThrow({ where: { id } });

  await ctx.answerCbQuery(`🤖 ${assistant.name}`);
  await ctx.editMessageReplyMarkup(undefined);

  return assistantDetails(ctx, id);
});

async function assistantDetails(ctx: BotContext, id: string) {
  const { prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({
    where: { id },
  });

  const isGuest = assistant.guestIds.includes(ctx.from?.id ?? 0);

  const isPersonalAssistant =
    assistant.name.toLowerCase() === "personal assistant";

  const keyboard = new InlineKeyboard()
    .row(
      InlineKeyboard.text(
        ctx.t("asst:btn.name"),
        `asst.${assistant.id}.name`,
        isGuest || isPersonalAssistant
      ),
      InlineKeyboard.text(
        ctx.t("asst:btn.inst"),
        `asst.${assistant.id}.inst`,
        isGuest || isPersonalAssistant
      )
    )
    .text(ctx.t("asst:btn.conv.new"), `asst.${assistant.id}.chat`)
    .text(
      (assistant.hasCode ? "✅ " : "") + ctx.t("asst:btn.codeinterpreter"),
      `asst.${assistant.id}.code`,
      isGuest
    )
    .text(
      (assistant.hasRss ? "✅ " : "") + ctx.t("asst:btn.rss"),
      `asst.${assistant.id}.rss`,
      isGuest
    )
    .text(
      (assistant.hasWeather ? "✅ " : "") + ctx.t("asst:btn.weather"),
      `asst.${assistant.id}.weather`,
      isGuest
    )
    .text(
      (assistant.hasGoogle ? "✅ " : "") + ctx.t("asst:btn.google"),
      `asst.${assistant.id}.google`,
      isGuest
    )
    .switchToChat(
      ctx.t("asst:btn.share"),
      assistant.name,
      isGuest || isPersonalAssistant
    )
    .text(ctx.t("btn.delete"), `asst.${assistant.id}.del`, isPersonalAssistant)
    .text(ctx.t("asst:btn.back.assts"), "asst.back");

  let response: string = ctx.t("asst:html.asst", {
    assistant: assistant.name,
    instructions: assistant.instructions
      ?.replace(/{{user}}/gi, ctx.from?.first_name ?? "User")
      .replace(/{user}/gi, ctx.from?.first_name ?? "User")
      .replace(/{{char}}/gi, assistant.name)
      .replace(/{char}/gi, assistant.name),
  });

  if (!isPersonalAssistant && !isGuest && assistant.guestIds.length)
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
  } catch (error) {
    try {
      await ctx.replyWithPhoto(
        assistant.image ?? Constants.thumbnail(assistant.name),
        { caption: `🖼️ <b>${assistant.name}</b>`, parse_mode: "HTML" }
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
      });
      if (!isPersonalAssistant && !isGuest && assistant.guestIds.length)
        response +=
          "\n\n" +
          ctx.t("asst:html.asst.shared", { count: assistant.guestIds.length });
      await ctx.replyWithHTML(response, { reply_markup: keyboard });
    }
  }
}

export default assistantScene;
