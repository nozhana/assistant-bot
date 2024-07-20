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
import OpenAIEventHandler from "../util/event-handler";
import { randomUUID } from "crypto";
import { RunSubmitToolOutputsParams } from "openai/resources/beta/threads/runs/runs";
import Parser from "rss-parser";
import Constants from "../util/constants";
import { AssistantStream } from "openai/lib/AssistantStream";

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
    select: { id: true, assistant: true, messages: true },
  });

  const response = await ctx.replyWithHTML(
    ctx.t("chat:html.chatting", { assistant: conversation.assistant.name }),
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: ctx.t("chat:btn.leave"), callback_data: "chat.leave" }],
        ],
      },
    }
  );

  if (conversation.assistant.greeting && !conversation.messages.length) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        messages: {
          create: {
            role: "ASSISTANT",
            content: conversation.assistant.greeting
              .replace(/{{user}}/gi, ctx.from?.first_name ?? "User")
              .replace(/{user}/gi, ctx.from?.first_name ?? "User"),
            userId: ctx.from!.id,
            assistantId: conversation.assistant.id,
            tokens: 0,
          },
        },
      },
    });
    try {
      await ctx.replyWithMarkdown(
        conversation.assistant.greeting
          .replace(/{{user}}/gi, ctx.from?.first_name ?? "User")
          .replace(/{user}/gi, ctx.from?.first_name ?? "User")
          .replace(/{{char}}/gi, conversation.assistant.name)
          .replace(/{char}/gi, conversation.assistant.name)
      );
    } catch {
      await ctx.reply(
        conversation.assistant.greeting
          .replace(/{{user}}/gi, ctx.from?.first_name ?? "User")
          .replace(/{user}/gi, ctx.from?.first_name ?? "User")
          .replace(/{{char}}/gi, conversation.assistant.name)
          .replace(/{char}/gi, conversation.assistant.name)
      );
    }
  }

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

  if (!transcription.text.length)
    return ctx.reply(ctx.t("chat:html.transcription.failed"));

  return handlePrompt(ctx, transcription.text);
});

chatScene.on(message("document"), async (ctx) => {
  const { prisma, openai } = ctx;
  const { conversationId } = ctx.scene.session;

  const { file_id } = ctx.message.document;
  const fileLink = await ctx.telegram.getFileLink(file_id);
  const res = await fetch(fileLink);
  const buffer = Buffer.from(await res.arrayBuffer());

  const waitMessage = await ctx.replyWithHTML(ctx.t("html.wait"));

  await ctx.sendChatAction("upload_document");
  let remoteFile: FileObject;
  try {
    remoteFile = await openai.files.create({
      file: await toFile(buffer, ctx.message.document.file_name),
      purpose: "assistants",
    });
  } catch (error) {
    return ctx.replyWithHTML(
      ctx.t("chat:html.doc.upload.failed") + `\n${error}`
    );
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
  const tool_resources: AssistantUpdateParams.ToolResources = {};

  tools.push({ type: "file_search" });

  const storeIds =
    remoteAsst.tool_resources?.file_search?.vector_store_ids ?? [];
  const codeFileIds =
    remoteAsst.tool_resources?.code_interpreter?.file_ids ?? [];

  tool_resources.file_search = { vector_store_ids: [...storeIds] };
  if (store) tool_resources.file_search.vector_store_ids?.push(store.id);

  if (remoteAsst.tools.filter((v) => v.type === "code_interpreter").length) {
    tools.push({ type: "code_interpreter" });
  }

  tool_resources.code_interpreter = {
    file_ids: [...codeFileIds, remoteFile.id],
  };

  tools.push(...remoteAsst.tools.filter((v) => v.type === "function"));

  await openai.beta.assistants.update(assistant.serversideId, {
    tools,
    tool_resources,
  });

  try {
    await ctx.deleteMessage(waitMessage.message_id);
  } catch {}
  return ctx.replyWithHTML(
    ctx.t("chat:html.doc.upload.success", {
      filename: remoteFile.filename,
      count: 2,
    })
  );
});

chatScene.command("leave", async (ctx) => {
  await ctx.scene.leave();
  return ctx.scene.enter("convScene");
});

chatScene.action("chat.leave", async (ctx) => {
  await ctx.answerCbQuery(ctx.t("chat:cb.leave"));
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

  const waitMessage = await ctx.replyWithHTML(ctx.t("html.wait"));

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { assistant: true, messages: true },
  });

  await ctx.sendChatAction("typing");

  const messages: {
    role: "USER" | "ASSISTANT" | "SYSTEM";
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

  let responseMessage: {
    id?: string;
    role: "USER" | "ASSISTANT" | "SYSTEM";
    content?: string;
  } = { role: "ASSISTANT" };

  const eventHandler = new OpenAIEventHandler(openai)
    .register("textDone", async (content) => {
      try {
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
              const res = await openai.files.content(
                annotation.file_path.file_id
              );
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

        const chunks = content.value.match(/[\s\S]{1,3895}/g) ?? [
          content.value,
        ];

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
              await ctx.reply(ctx.t("chat:html.response.audio.failed"));
              continue;
            }

            await ctx.sendChatAction("upload_voice");
            await ctx.replyWithVoice({
              source: audioBuffer,
              filename: `${ctx.message?.message_id}.ogg`,
            });
          }
        } else {
          for (let chunk of chunks) {
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
      } catch (error) {
        try {
          await ctx.deleteMessage(waitMessage.message_id);
        } catch {}
        await ctx.replyWithHTML(`❌ Error! ${error}`);
      }
    })
    .register("imageDone", async (image) => {
      try {
        if (typeof image === "string") {
          const res = await fetch(image);
          const buffer = Buffer.from(await res.arrayBuffer());
          await ctx.replyWithPhoto({
            source: buffer,
            filename: `${image}.png`,
          });
        } else {
          await ctx.replyWithPhoto({
            source: image,
            filename: `${randomUUID()}.png`,
          });
        }
      } catch (error) {
        try {
          await ctx.deleteMessage(waitMessage.message_id);
        } catch {}
        await ctx.replyWithHTML(`❌ Error! ${error}`);
      }
    })
    .register("toolCallsAction", async (toolCalls) => {
      const toolOutputs: RunSubmitToolOutputsParams.ToolOutput[] = [];

      try {
        for (const toolCall of toolCalls) {
          const params = JSON.parse(toolCall.function.arguments);
          switch (toolCall.function.name) {
            case "fetchRssFeed":
              await ctx.replyWithHTML(
                ctx.t("chat:html.rss.created", { url: params.url })
              );
              const rss = await new Parser().parseURL(params.url);
              const output: {
                title?: string;
                link?: string;
                description?: string;
                image?: { link?: string; url: string; title?: string };
                items?: {
                  title?: string;
                  link?: string;
                  description?: string;
                  summary?: string;
                  contentSnippet?: string;
                  pubDate?: string;
                }[];
              } = { ...rss };

              output.items = output.items?.slice(0, 10);

              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify(output),
              });
              break;
            case "fetchWeather":
              await ctx.replyWithHTML(
                ctx.t("chat:html.weather.created", {
                  query: params.query,
                })
              );
              let weather: string;
              const apiKey = process.env.WEATHERSTACK_API_KEY;
              if (!apiKey) {
                weather =
                  "Cannot access the weather API for data. Instruct the user to try again later.";
              } else {
                const req = Constants.getWeather(apiKey, params.query);
                const res = await fetch(req);
                weather = await res.text();
              }

              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: weather,
              });
              break;
            default:
              break;
          }
        }
      } catch (error) {
        try {
          await ctx.deleteMessage(waitMessage.message_id);
        } catch {}
        await ctx.replyWithHTML(`❌ Error! ${error}`);
      }

      return toolOutputs;
    })
    .register("toolCallsDone", async (toolCalls) => {
      try {
        for (const toolCall of toolCalls) {
          switch (toolCall.type) {
            case "code_interpreter":
              let response = ctx.t("chat:html.codeinterpreter.done") + "\n";
              let mediaGroup: InputMediaPhoto[] = [];
              for (let output of toolCall.code_interpreter.outputs) {
                if (output.type === "logs") {
                  response +=
                    ctx.t("chat:html.codeinterpreter.done") +
                    "\n<pre>" +
                    escapeHtml(output.logs) +
                    "</pre>\n";
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
              await ctx.replyWithHTML(ctx.t("chat:html.filesearch.done"));
              break;
            case "function":
              switch (toolCall.function.name) {
                case "fetchRssFeed":
                  await ctx.replyWithHTML(ctx.t("chat:html.rss.done"));
                  break;
                case "fetchWeather":
                  await ctx.replyWithHTML(ctx.t("chat:html.weather.done"));
                  break;
                default:
                  break;
              }
              break;
          }
        }
      } catch (error) {
        try {
          await ctx.deleteMessage(waitMessage.message_id);
        } catch {}
        await ctx.replyWithHTML(`❌ Error! ${error}`);
      }
    })
    .register("runCompleted", async (runId, threadId) => {
      try {
        const run = await openai.beta.threads.runs.retrieve(threadId, runId);
        await prisma.message.update({
          where: { id: userMessage.id },
          data: { tokens: run.usage?.prompt_tokens },
        });
        if (responseMessage.id)
          await prisma.message.update({
            where: { id: responseMessage.id },
            data: { tokens: run.usage?.completion_tokens },
          });
        await ctx.replyWithHTML(
          ctx.t("chat:html.usage", {
            promptTokens: run.usage?.prompt_tokens,
            completionTokens: run.usage?.completion_tokens,
            totalTokens: run.usage?.total_tokens,
          })
        );
      } catch (error) {
        try {
          await ctx.deleteMessage(waitMessage.message_id);
        } catch {}
        await ctx.replyWithHTML(`❌ Error! ${error}`);
      }
    });

  let stream: AssistantStream;
  try {
    stream = openai.beta.threads.createAndRunStream({
      assistant_id: conversation.assistant.serversideId,
      model: "gpt-4o",
      instructions: conversation.assistant.instructions
        ?.replace(/{{user}}/gi, ctx.from?.first_name ?? "User")
        .replace(/{user}/gi, ctx.from?.first_name ?? "User")
        .replace(/{{char}}/gi, conversation.assistant.name)
        .replace(/{char}/gi, conversation.assistant.name),
      thread: {
        messages: messages.map((e) => ({
          content: e.content,
          role: e.role === "ASSISTANT" ? "assistant" : "user",
        })),
      },
      temperature: 0.7,
      max_completion_tokens: 4095,
      parallel_tool_calls: false,
      truncation_strategy: { type: "last_messages", last_messages: 10 },
    });

    // for await (const event of stream) {
    //   eventHandler.emit("event", event);
    // }
    await eventHandler.observe(stream);
  } catch (error) {
    return ctx.reply("🛑 Error: " + error);
  }

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
          ctx.t("chat:html.rename") + "\n<b>" + titles[0] + "</b>"
        );
      }
    }
  }
}
