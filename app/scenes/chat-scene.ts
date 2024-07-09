import { Scenes } from "telegraf";
import { toFile } from "openai";
import BotContext from "../middlewares/bot-context";
import { message } from "telegraf/filters";
import { randomUUID } from "crypto";
import { ChatCompletionMessageParam } from "openai/resources";
import { Role } from "@prisma/client";

const chatScene = new Scenes.BaseScene<BotContext>("chatScene");

chatScene.enter(async (ctx) => {
  const { prisma, currentConversationId } = ctx.session;
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: currentConversationId },
    select: { assistant: true },
  });

  return ctx.replyWithHTML(
    `You're now talking to <b>${conversation.assistant.name}</b>.`
  );
});

chatScene.on(message("text"), async (ctx, next) => {
  if (ctx.text.startsWith("/")) return next();

  const { prisma, openai, currentConversationId } = ctx.session;

  const waitMessage = await ctx.replyWithHTML("<i>Please wait...</i>");

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: currentConversationId },
    include: { assistant: true, messages: true },
  });

  await ctx.sendChatAction("typing");

  const messages: ChatCompletionMessageParam[] = [];
  conversation.messages.forEach((m) => {
    messages.push({
      role: m.role === "ASSISTANT" ? "assistant" : "user",
      content: m.content,
      name: m.role === "ASSISTANT" ? "Assistant" : ctx.from.first_name,
    });
  });
  const userMessage: ChatCompletionMessageParam = {
    role: "user",
    content: ctx.message.text,
    name: ctx.from.first_name,
  };
  messages.push(userMessage);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    user: String(conversation.userId),
    temperature: 0.7,
    max_tokens: 512,
  });

  const response = completion.choices[0].message.content;
  if (!response) {
    await ctx.deleteMessage(waitMessage.message_id);
    return ctx.reply("No response. Please try again with different wording.");
  }

  await prisma.conversation.update({
    where: { id: currentConversationId },
    data: {
      messages: {
        createMany: {
          data: [
            {
              role: "USER",
              content: userMessage.content.toString(),
              tokens: completion.usage?.prompt_tokens ?? 0,
              userId: conversation.userId,
              assistantId: conversation.assistantId,
            },
            {
              role: "ASSISTANT",
              content: response,
              tokens: completion.usage?.completion_tokens ?? 0,
              userId: conversation.userId,
              assistantId: conversation.assistantId,
            },
          ],
        },
      },
    },
  });

  if (ctx.session.isVoiceResponse) {
    await ctx.sendChatAction("record_voice");
    const audioRes = await openai.audio.speech.create({
      input: response,
      model: "tts-1",
      voice: "alloy",
    });
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    if (!audioBuffer.length) {
      await ctx.deleteMessage(waitMessage.message_id);
      return ctx.reply("Failed to encode response audio.");
    }

    await ctx.deleteMessage(waitMessage.message_id);
    await ctx.sendChatAction("upload_voice");
    return ctx.replyWithVoice({
      source: audioBuffer,
      filename: `${randomUUID()}.ogg`,
    });
  }

  await ctx.deleteMessage(waitMessage.message_id);
  try {
    return ctx.replyWithMarkdown(
      `${response}
💸 **${completion.usage?.total_tokens}** tokens`
    );
  } catch (error) {
    return ctx.reply(
      `${response}
💸 ${completion.usage?.total_tokens} tokens`
    );
  }
});

chatScene.on(message("voice"), async (ctx) => {
  const { prisma, openai, currentConversationId } = ctx.session;
  const { file_id } = ctx.message.voice;
  const fileURL = await ctx.telegram.getFileLink(file_id);
  const res = await fetch(fileURL);
  const blob = await res.blob();

  const waitMessage = await ctx.replyWithHTML("<i>Please wait...</i>");

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: currentConversationId },
    include: { assistant: true, messages: true },
  });

  const transcription = await openai.audio.transcriptions.create({
    file: await toFile(blob, `${file_id}.ogg`),
    model: "whisper-1",
  });

  if (!transcription.text.length) return ctx.reply("Transcription failed.");

  await ctx.sendChatAction("typing");

  const messages: ChatCompletionMessageParam[] = [];
  conversation.messages.forEach((m) => {
    messages.push({
      role: m.role === "ASSISTANT" ? "assistant" : "user",
      content: m.content,
      name: m.role === "ASSISTANT" ? "Assistant" : ctx.from.first_name,
    });
  });
  const userMessage: ChatCompletionMessageParam = {
    role: "user",
    content: transcription.text,
    name: ctx.from.first_name,
  };
  messages.push(userMessage);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    user: String(conversation.userId),
    temperature: 0.7,
    max_tokens: 512,
  });

  const response = completion.choices[0].message.content;

  if (!response) {
    await ctx.deleteMessage(waitMessage.message_id);
    return ctx.reply("No response. Please try again with different wording.");
  }

  await prisma.conversation.update({
    where: { id: currentConversationId },
    data: {
      messages: {
        createMany: {
          data: [
            {
              role: "USER",
              content: userMessage.content.toString(),
              tokens: completion.usage?.prompt_tokens ?? 0,
              userId: conversation.userId,
              assistantId: conversation.assistantId,
            },
            {
              role: "ASSISTANT",
              content: response,
              tokens: completion.usage?.completion_tokens ?? 0,
              userId: conversation.userId,
              assistantId: conversation.assistantId,
            },
          ],
        },
      },
    },
  });

  if (ctx.session.isVoiceResponse) {
    await ctx.sendChatAction("record_voice");
    const audioRes = await openai.audio.speech.create({
      input: `${response}\nThis prompt cost you ${completion.usage?.total_tokens} tokens.`,
      model: "tts-1",
      voice: "alloy",
    });
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    if (!audioBuffer.length) {
      await ctx.deleteMessage(waitMessage.message_id);
      return ctx.reply("Failed to encode response audio.");
    }

    await ctx.deleteMessage(waitMessage.message_id);
    await ctx.sendChatAction("upload_voice");
    return ctx.replyWithVoice({
      source: audioBuffer,
      filename: `${randomUUID()}.ogg`,
    });
  }

  await ctx.deleteMessage(waitMessage.message_id);
  try {
    return ctx.replyWithMarkdown(
      `${response}
💸 **${completion.usage?.total_tokens}** tokens`
    );
  } catch (error) {
    return ctx.reply(
      `${response}
💸 ${completion.usage?.total_tokens} tokens`
    );
  }
});

chatScene.command("leave", async (ctx) => {
  return ctx.scene.leave();
});

chatScene.leave(async (ctx) => {
  const { prisma, currentConversationId } = ctx.session;
  const conversation = await prisma.conversation.findUnique({
    where: { id: currentConversationId },
    select: { assistant: true },
  });

  delete ctx.session.currentConversationId;

  return ctx.replyWithHTML(
    `<b>${conversation?.assistant.name}</b> says Goodbye!`
  );
});

export default chatScene;
