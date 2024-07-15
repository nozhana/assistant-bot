import { Scenes } from "telegraf";
import BotContext from "../middlewares/bot-context";
import { AssistantTool } from "openai/resources/beta/assistants";
import InlineKeyboard from "../util/inline-keyboard";
import initializeUserAndPersonalAssistant from "../handlers/init-user";
import Constants from "../util/constants";

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
    .text(ctx.t("asst:btn.new"), "asst.new")
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

assistantScene.action(/asst\.[^.]+\.chat/g, async (ctx) => {
  const id = ctx.match[0].split(".")[1];
  const { prisma } = ctx;
  const conversation = await prisma.conversation.create({
    data: { userId: ctx.from.id, assistantId: id },
  });
  await ctx.answerCbQuery(ctx.t("chat:cb.chatting"));
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.scene.enter("chatScene", { conversationId: conversation.id });
});

assistantScene.action(/asst\.[^.]+\.name/g, async (ctx) => {
  // const id = ctx.match[0].split(".")[1];
  return ctx.answerCbQuery(ctx.t("coming.soon"), { show_alert: true });
});

assistantScene.action(/asst\.[^.]+\.inst/g, async (ctx) => {
  return ctx.answerCbQuery(ctx.t("coming.soon"), { show_alert: true });
});

assistantScene.action(/asst\.[^.]+\.code/g, async (ctx) => {
  const id = ctx.match[0].split(".")[1];
  const { prisma, openai } = ctx;
  const localAsst = await prisma.assistant.findUniqueOrThrow({ where: { id } });
  const remoteAsst = await openai.beta.assistants.retrieve(
    localAsst.serversideId
  );
  const isCodeOn = remoteAsst.tools.filter(
    (v) => v.type === "code_interpreter"
  ).length;

  const tools: AssistantTool[] = remoteAsst.tools.filter(
    (v) => v.type !== "code_interpreter"
  );

  if (!isCodeOn) {
    tools.push({ type: "code_interpreter" });
  }

  await openai.beta.assistants.update(localAsst.serversideId, { tools });

  await ctx.answerCbQuery(
    ctx.t(
      isCodeOn ? "asst:cb.codeinterpreter.off" : "asst:cb.codeinterpreter.on",
      { assistant: remoteAsst.name }
    ),
    { show_alert: true }
  );
});

assistantScene.action(/asst\.[^.]+$/g, async (ctx) => {
  const id = ctx.match[0].split(".").pop();
  if (!id) return ctx.scene.reenter();

  const { prisma } = ctx;
  const assistant = await prisma.assistant.findUniqueOrThrow({
    where: { id },
  });

  const isGuest = (await prisma.user.count({
    where: {
      id: ctx.from.id,
      guestAssistantIds: { has: id },
      assistants: { none: { id } },
    },
  }))
    ? true
    : false;

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
      ctx.t("asst:btn.codeinterpreter"),
      `asst.${assistant.id}.code`,
      isGuest || isPersonalAssistant
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
    instructions: assistant.instructions,
  });

  if (!isPersonalAssistant && !isGuest && assistant.guestIds.length)
    response +=
      "\n\n" +
      ctx.t("asst:html.asst.shared", { count: assistant.guestIds.length });

  await ctx.answerCbQuery(`🤖 ${assistant.name}`);
  await ctx.editMessageReplyMarkup(undefined);
  return ctx.replyWithPhoto(Constants.thumbnail(assistant.name), {
    caption: response,
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
});

export default assistantScene;
