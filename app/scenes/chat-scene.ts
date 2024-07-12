import { Scenes } from "telegraf";
import { toFile } from "openai";
import BotContext from "../middlewares/bot-context";
import { message } from "telegraf/filters";
import {
  AssistantTool,
  AssistantUpdateParams,
} from "openai/resources/beta/assistants";
import escapeHtml from "../util/escape-html";
import { InputMediaPhoto } from "telegraf/typings/core/types/typegram";
import { VectorStore } from "openai/resources/beta/vector-stores/vector-stores";
import { FileObject } from "openai/resources";

const chatScene = new Scenes.BaseScene<BotContext>("chatScene");
export default chatScene;

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
    return next();
  }

  return handlePrompt(ctx, ctx.text);
});

chatScene.on(message("voice"), async (ctx) => {
  const { openai } = ctx;
  const { file_id } = ctx.message.voice;
  const fileURL = await ctx.telegram.getFileLink(file_id);
  const res = await fetch(fileURL);
  const buffer = Buffer.from(await res.arrayBuffer());

  const transcription = await openai.audio.transcriptions.create({
    file: await toFile(buffer, `${file_id}.ogg`),
    model: "whisper-1",
  });

  if (!transcription.text.length) return ctx.reply("Transcription failed.");

  return handlePrompt(ctx, transcription.text);
});

chatScene.on(message("document"), async (ctx) => {
  const { prisma, openai } = ctx;
  const { conversationId } = ctx.scene.session;

  const { file_id } = ctx.message.document;
  const fileLink = await ctx.telegram.getFileLink(file_id);
  const res = await fetch(fileLink);
  const buffer = Buffer.from(await res.arrayBuffer());

  const waitMessage = await ctx.replyWithHTML("<i>Please wait...</i>");

  await ctx.sendChatAction("upload_document");
  let remoteFile: FileObject;
  try {
    remoteFile = await openai.files.create({
      file: await toFile(buffer, ctx.message.document.file_name),
      purpose: "assistants",
    });
  } catch (error) {
    return ctx.replyWithHTML(`❌ <b>Failed to upload document.</b>\n${error}`);
  }

  const assistant = (
    await prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { assistant: true },
    })
  ).assistant;

  await ctx.sendChatAction("typing");
  let store: VectorStore | null = null;
  try {
    store = await openai.beta.vectorStores.create({
      name: ctx.message.document.file_name,
      file_ids: [remoteFile.id],
      expires_after: { anchor: "last_active_at", days: 2 },
    });
  } catch {}

  const remoteAsst = await openai.beta.assistants.retrieve(
    assistant.serversideId
  );

  const tools: AssistantTool[] = [];
  const toolResources: AssistantUpdateParams.ToolResources = {};

  tools.push({ type: "file_search" });

  const storeIds =
    remoteAsst.tool_resources?.file_search?.vector_store_ids ?? [];
  const codeFileIds =
    remoteAsst.tool_resources?.code_interpreter?.file_ids ?? [];

  if (store)
    toolResources.file_search = { vector_store_ids: [store.id, ...storeIds] };

  if (remoteAsst.tools.filter((v) => v.type === "code_interpreter").length) {
    tools.push({ type: "code_interpreter" });
    toolResources.code_interpreter = {
      file_ids: [remoteFile.id, ...codeFileIds],
    };
  }

  await openai.beta.assistants.update(assistant.serversideId, {
    tools,
    tool_resources: toolResources,
  });

  try {
    await ctx.deleteMessage(waitMessage.message_id);
  } catch {}
  return ctx.replyWithHTML(`📎 Attached document to assistant.
📁 <b>Filename:</b> <code>${remoteFile.filename}</code>

⏳ This file is set to expire after <b>2 days</b> of inactivity.`);
});

chatScene.command("leave", async (ctx) => {
  await ctx.scene.leave();
  return ctx.scene.enter("convScene");
});

chatScene.action("chat.leave", async (ctx) => {
  await ctx.answerCbQuery("🚫 Left conversation.");
  await ctx.editMessageReplyMarkup(undefined);
  await ctx.scene.leave();
  return ctx.scene.enter("convScene");
});

chatScene.leave(async (ctx) => {
  await ctx.unpinAllChatMessages();
});

async function handlePrompt(ctx: BotContext, text: string) {
  const { prisma, openai } = ctx;
  const { conversationId } = ctx.scene.session;

  const waitMessage = await ctx.replyWithHTML("<i>Please wait...</i>");

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { assistant: true, messages: true },
  });

  await ctx.sendChatAction("typing");

  const messages: {
    role: "USER" | "ASSISTANT";
    content: string;
  }[] = [];

  messages.push(...conversation.messages);
  messages.push({ role: "USER", content: text });

  const userMessage = await prisma.message.create({
    data: {
      role: "USER",
      content: text,
      tokens: 0,
      userId: conversation.userId,
      assistantId: conversation.assistantId,
      conversationId: conversation.id,
    },
  });

  const stream = openai.beta.threads.createAndRunStream({
    assistant_id: conversation.assistant.serversideId,
    model: "gpt-4o",
    instructions:
      conversation.assistant.instructions +
      "\nRespond in Telegram Markdown V2 format.",
    thread: {
      messages: messages.map((e) => ({
        content: e.content,
        role: e.role === "ASSISTANT" ? "assistant" : "user",
      })),
    },
    temperature: 0.7,
    max_completion_tokens: 8192,
  });

  let responseMessage: {
    id?: string;
    role: "USER" | "ASSISTANT";
    content?: string;
  } = { role: "ASSISTANT" };

  stream.on("textDone", async (content) => {
    const message = await prisma.message.create({
      data: {
        role: "ASSISTANT",
        content: content.value,
        tokens: stream.currentRun()?.usage?.completion_tokens ?? 0,
        userId: conversation.userId,
        assistantId: conversation.assistantId,
        conversationId: conversation.id,
      },
    });
    responseMessage = message;

    if (content.annotations) {
      for (let annotation of content.annotations) {
        if (annotation.type === "file_path") {
          const res = await openai.files.content(annotation.file_path.file_id);
          const buffer = Buffer.from(await res.arrayBuffer());
          await ctx.replyWithDocument(
            {
              source: buffer,
              filename: annotation.text.split("/").pop(),
            },
            { caption: `📁 ${annotation.file_path.file_id}` }
          );
        }
      }
    }

    const chunks = content.value.match(/[\s\S]{1,3895}/g) ?? [content.value];

    if (ctx.session.settings.isVoiceResponse) {
      await ctx.sendChatAction("record_voice");
      for (let chunk of chunks) {
        const audioRes = await openai.audio.speech.create({
          input: chunk,
          model: "tts-1",
          voice: ctx.session.settings.voice,
          response_format: "opus",
        });
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        if (!audioBuffer.length) {
          try {
            await ctx.deleteMessage(waitMessage.message_id);
          } catch {}
          await ctx.reply("Failed to encode response audio.");
          continue;
        }

        await ctx.sendChatAction("upload_voice");
        await ctx.replyWithVoice({
          source: audioBuffer,
          filename: `${ctx.message?.message_id}.ogg`,
        });
      }
      try {
        await renameConversationIfNeeded(userMessage.content, chunks[0]);
        await ctx.deleteMessage(waitMessage.message_id);
      } catch {}
      return;
    }

    for (let chunk of chunks) {
      try {
        await ctx.replyWithMarkdownV2(chunk);
      } catch {
        try {
          await ctx.replyWithMarkdown(chunk);
        } catch {
          await ctx.reply(chunk);
        }
      }
    }

    try {
      await renameConversationIfNeeded(userMessage.content, chunks[0]);
      await ctx.deleteMessage(waitMessage.message_id);
    } catch {}
  });

  stream.on("toolCallCreated", async (toolCall) => {
    switch (toolCall.type) {
      case "code_interpreter":
        await ctx.replyWithHTML(
          `🧑‍💻 <i>Running code...</i>\n${escapeHtml(
            toolCall.code_interpreter.input
          )}`
        );
        break;
      case "file_search":
        await ctx.replyWithHTML(`📁 <i>Searching files...</i>`);
        break;
      default:
        break;
    }
  });

  stream.on("toolCallDone", async (toolCall) => {
    switch (toolCall.type) {
      case "code_interpreter":
        let response = "🧑‍💻 <i>Code run successfully.</i>\n";
        let mediaGroup: InputMediaPhoto[] = [];
        for (let output of toolCall.code_interpreter.outputs) {
          if (output.type === "logs") {
            response += `<b>Console log \></b>\n<pre>${escapeHtml(
              output.logs
            )}</pre>\n`;
          } else {
            const res = await openai.files.content(output.image.file_id);
            mediaGroup.push({
              type: "photo",
              media: res,
              caption: `<code>${output.image.file_id}.png</code>`,
              parse_mode: "HTML",
            });
          }
        }

        if (mediaGroup.length) await ctx.replyWithMediaGroup(mediaGroup);
        await ctx.replyWithHTML(response);
        break;
      case "file_search":
        await ctx.replyWithHTML("📁 <i>File search done.</i>");
      case "function":
        break;
    }
  });

  stream.on("imageFileDone", async (content) => {
    const res = await openai.files.content(content.file_id);
    const buffer = Buffer.from(await res.arrayBuffer());
    await ctx.replyWithPhoto({
      source: buffer,
      filename: `${content.file_id}.png`,
    });
  });

  stream.on("end", async () => {
    const run = await stream.finalRun();
    await prisma.message.update({
      where: { id: userMessage.id },
      data: { tokens: run.usage?.prompt_tokens },
    });
    await prisma.message.update({
      where: { id: responseMessage.id },
      data: { tokens: run.usage?.completion_tokens },
    });
    await ctx.replyWithHTML(`
🗨️ <b>Prompt:</b> <code>${run.usage?.prompt_tokens} tokens</code>
💬 <b>Completion:</b> <code>${run.usage?.completion_tokens} tokens</code>

💸 <b>Total:</b> <code>${run.usage?.total_tokens} tokens</code>`);
  });

  async function renameConversationIfNeeded(prompt: string, response: string) {
    if (!conversation.title) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        n: 3,
        max_tokens: 50,
        messages: [
          {
            role: "system",
            content:
              "You are a conversation naming assistant. Come up with a title for the following messages between an assistant and a user. The title should not be longer than 36 characters. The title should not be surrounded by quotes or other punctuations. Only generate the conversation title.",
          },
          {
            role: "user",
            content: prompt,
          },
          {
            role: "assistant",
            content: response,
          },
        ],
      });

      const titles = completion.choices
        .map((v) => v.message.content)
        .filter((v) => v && v.length <= 36);

      if (titles.length) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { title: titles[0] },
        });

        await ctx.replyWithHTML(
          `✨ Renamed conversation:\n<b>${titles[0]}</b>`
        );
      }
    }
  }
}
