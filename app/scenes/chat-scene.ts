import { Scenes } from "telegraf";
import { toFile } from "openai";
import BotContext from "../middlewares/bot-context";
import { message } from "telegraf/filters";
import { randomUUID } from "crypto";
import { TextContentBlock } from "openai/resources/beta/threads/messages";
import { createReadStream } from "fs";

const chatScene = new Scenes.BaseScene<BotContext>("chatScene");

chatScene.enter(async (ctx) => {
  const { prisma } = ctx;
  const { conversationId } = ctx.scene.session.state as {
    conversationId: string;
  };
  ctx.scene.session.conversationId = conversationId;
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { assistant: true },
  });

  const response = await ctx.replyWithHTML(
    `You're now talking to <b>${conversation.assistant.name}</b>.`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "🚫 Leave", callback_data: "chat.leave" }]],
      },
    }
  );
  return ctx.pinChatMessage(response.message_id);
});

chatScene.on(message("text"), async (ctx, next) => {
  if (ctx.text.startsWith("/")) {
    await ctx.scene.leave();
    if (ctx.text === "/leave") {
      return ctx.scene.enter("convScene");
    }
    return next();
  }

  const { prisma, openai } = ctx;
  const { conversationId } = ctx.scene.session;

  const waitMessage = await ctx.replyWithHTML("<i>Please wait...</i>");

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { assistant: true, messages: true },
  });

  await ctx.sendChatAction("typing");

  const messages: {
    role: "user" | "assistant";
    content: string;
  }[] = [];

  conversation.messages.forEach((m) => {
    messages.push({
      role: m.role === "ASSISTANT" ? "assistant" : "user",
      content: m.content,
    });
  });
  const userMessage: {
    role: "user" | "assistant";
    content: string;
  } = {
    role: "user",
    content: ctx.message.text,
  };
  messages.push(userMessage);

  const run = await openai.beta.threads.createAndRunPoll({
    assistant_id: conversation.assistant.serversideId,
    model: "gpt-4o",
    thread: { messages },
    temperature: 0.7,
    max_completion_tokens: 512,
  });

  const remoteMessages = await openai.beta.threads.messages.list(run.thread_id);
  const response = (remoteMessages.data[0].content[0] as TextContentBlock)?.text
    .value;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      messages: {
        createMany: {
          data: [
            {
              role: "USER",
              content: userMessage.content.toString(),
              tokens: run.usage?.prompt_tokens ?? 0,
              userId: conversation.userId,
              assistantId: conversation.assistantId,
            },
            {
              role: "ASSISTANT",
              content: response,
              tokens: run.usage?.completion_tokens ?? 0,
              userId: conversation.userId,
              assistantId: conversation.assistantId,
            },
          ],
        },
      },
    },
  });

  if (!conversation.title) {
    const nameCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      max_tokens: 24,
      user: String(ctx.from.id),
      n: 3,
      messages: [
        {
          role: "system",
          content:
            "You are a conversation naming assistant. You are given a conversation between a user and an AI assistant. Your job is to come up with a title for this conversation that is at most 36 characters.",
        },
        ...messages,
        { role: "assistant", content: response },
      ],
    });
    let titles = nameCompletion.choices.filter(
      (v) => (v.message.content?.length ?? 100) <= 36
    );

    if (titles.length) {
      const title = titles[0].message.content;
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });

      await ctx.replyWithHTML(`✨ Renamed conversation to <b>${title}</b>`);
    }
  }

  if (ctx.session.settings.isVoiceResponse) {
    await ctx.sendChatAction("record_voice");
    const audioRes = await openai.audio.speech.create({
      input: response,
      model: "tts-1",
      voice: ctx.session.settings.voice,
    });
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    if (!audioBuffer.length) {
      await ctx.deleteMessage(waitMessage.message_id);
      return ctx.reply("Failed to encode response audio.");
    }

    await ctx.deleteMessage(waitMessage.message_id);
    await ctx.sendChatAction("upload_voice");
    return ctx.replyWithVoice(
      {
        source: audioBuffer,
        filename: `${randomUUID()}.ogg`,
      },
      {
        caption: `💸 <b>${run.usage?.total_tokens} tokens</b>`,
        parse_mode: "HTML",
      }
    );
  }

  await ctx.deleteMessage(waitMessage.message_id);
  try {
    return ctx.replyWithMarkdown(
      `${response}

💸 **${run.usage?.total_tokens} tokens**`
    );
  } catch (error) {
    return ctx.reply(
      `${response}

💸 ${run.usage?.total_tokens} tokens`
    );
  }
});

chatScene.on(message("voice"), async (ctx) => {
  const { prisma, openai } = ctx;
  const { conversationId } = ctx.scene.session;
  const { file_id } = ctx.message.voice;
  const fileURL = await ctx.telegram.getFileLink(file_id);
  const res = await fetch(fileURL);
  const blob = await res.blob();

  const waitMessage = await ctx.replyWithHTML("<i>Please wait...</i>");

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { assistant: true, messages: true },
  });

  const transcription = await openai.audio.transcriptions.create({
    file: await toFile(blob, `${file_id}.ogg`),
    model: "whisper-1",
  });

  if (!transcription.text.length) return ctx.reply("Transcription failed.");

  await ctx.sendChatAction("typing");

  const messages: {
    role: "user" | "assistant";
    content: string;
  }[] = [];

  conversation.messages.forEach((m) => {
    messages.push({
      role: m.role === "ASSISTANT" ? "assistant" : "user",
      content: m.content,
    });
  });
  const userMessage: {
    role: "user" | "assistant";
    content: string;
  } = {
    role: "user",
    content: transcription.text,
  };
  messages.push(userMessage);

  const run = await openai.beta.threads.createAndRunPoll({
    assistant_id: conversation.assistant.serversideId,
    model: "gpt-4o",
    thread: { messages },
    temperature: 0.7,
    max_completion_tokens: 512,
  });

  const remoteMessages = await openai.beta.threads.messages.list(run.thread_id);
  const response = (remoteMessages.data[0].content[0] as TextContentBlock).text
    .value;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      messages: {
        createMany: {
          data: [
            {
              role: "USER",
              content: userMessage.content.toString(),
              tokens: run.usage?.prompt_tokens ?? 0,
              userId: conversation.userId,
              assistantId: conversation.assistantId,
            },
            {
              role: "ASSISTANT",
              content: response,
              tokens: run.usage?.completion_tokens ?? 0,
              userId: conversation.userId,
              assistantId: conversation.assistantId,
            },
          ],
        },
      },
    },
  });

  if (!conversation.title) {
    const nameCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      max_tokens: 24,
      user: String(ctx.from.id),
      n: 3,
      messages: [
        {
          role: "system",
          content:
            "You are a conversation naming assistant. You are given a conversation between a user and an AI assistant. Your job is to come up with a title for this conversation that is at most 24 characters. Name this conversation.",
        },
        userMessage,
        { role: "assistant", content: response },
      ],
    });
    let titles = nameCompletion.choices.filter(
      (v) => (v.message.content?.length ?? 100) <= 24
    );

    if (titles.length) {
      const title = titles[0].message.content;
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });

      await ctx.replyWithHTML(`✨ Renamed conversation to <b>${title}</b>`);
    }
  }

  if (ctx.session.settings.isVoiceResponse) {
    await ctx.sendChatAction("record_voice");
    const audioRes = await openai.audio.speech.create({
      input: response,
      model: "tts-1",
      voice: ctx.session.settings.voice,
    });
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    if (!audioBuffer.length) {
      await ctx.deleteMessage(waitMessage.message_id);
      return ctx.reply("Failed to encode response audio.");
    }

    await ctx.deleteMessage(waitMessage.message_id);
    await ctx.sendChatAction("upload_voice");
    return ctx.replyWithVoice(
      {
        source: audioBuffer,
        filename: `${randomUUID()}.ogg`,
      },
      {
        caption: `💸 <b>${run.usage?.total_tokens} tokens</b>`,
        parse_mode: "HTML",
      }
    );
  }

  await ctx.deleteMessage(waitMessage.message_id);
  try {
    return ctx.replyWithMarkdown(
      `${response}

💸 **${run.usage?.total_tokens} tokens**`
    );
  } catch (error) {
    return ctx.reply(
      `${response}

💸 ${run.usage?.total_tokens} tokens`
    );
  }
});

chatScene.on(message("document"), async (ctx) => {
  const { prisma, openai } = ctx;
  const { conversationId } = ctx.scene.session;

  const { file_id } = ctx.message.document;
  const fileLink = await ctx.telegram.getFileLink(file_id);
  const res = await fetch(fileLink);

  const waitMessage = await ctx.replyWithHTML("<i>Please wait...</i>");

  await ctx.sendChatAction("upload_document");
  const remoteFile = await openai.files.create({
    file: res,
    purpose: "assistants",
  });

  const assistant = (
    await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { assistant: true },
    })
  ).assistant;

  await ctx.sendChatAction("typing");
  const store = await openai.beta.vectorStores.create({
    name: `${assistant.name} storage`,
    file_ids: [remoteFile.id],
    expires_after: { anchor: "last_active_at", days: 7 },
  });

  const storeIds =
    (await openai.beta.assistants.retrieve(assistant.serversideId))
      .tool_resources?.file_search?.vector_store_ids ?? [];

  await openai.beta.assistants.update(assistant.serversideId, {
    tools: [{ type: "file_search" }],
    tool_resources: {
      file_search: { vector_store_ids: [...storeIds, store.id] },
    },
  });

  await ctx.deleteMessage(waitMessage.message_id);
  return ctx.replyWithHTML(`📎 Attached document to assistant.
📁 <b>Filename:</b> <code>${remoteFile.filename}</code>
🗄️ <b>Store:</b> <code>${store.name}</code>

⚠️ This file is set to expire after <b>7 days</b> of not being referenced.`);
});

chatScene.command("leave", async (ctx) => {
  return ctx.scene.leave();
});

chatScene.action("chat.leave", async (ctx) => {
  await ctx.scene.leave();
  return ctx.scene.enter("convScene");
});

chatScene.leave(async (ctx) => {
  await ctx.unpinAllChatMessages();
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery("🚫 Left conversation.");
    await ctx.editMessageReplyMarkup(undefined);
  }
});

export default chatScene;
