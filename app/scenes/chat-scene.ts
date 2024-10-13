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
import { FileObject } from "openai/resources";
import OpenAIEventHandler from "../util/event-handler";
import { randomUUID } from "crypto";
import { RunSubmitToolOutputsParams } from "openai/resources/beta/threads/runs/runs";
import Parser from "rss-parser";
import Constants from "../util/constants";
import { AssistantStream } from "openai/lib/AssistantStream";
import InlineKeyboard from "../util/inline-keyboard";

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
    const message = await prisma.message.create({
      data: {
        content: conversation.assistant.greeting
          .replace(/{{user}}/gi, ctx.from?.first_name ?? "User")
          .replace(/{user}/gi, ctx.from?.first_name ?? "User")
          .replace(/{{char}}/gi, conversation.assistant.name)
          .replace(/{char}/gi, conversation.assistant.name),
        role: "ASSISTANT",
        user: { connect: { id: ctx.from!.id } },
        assistant: { connect: { id: conversation.assistant.id } },
        conversation: { connect: { id: conversation.id } },
        tokens: 0,
      },
    });

    try {
      await ctx.replyWithMarkdown(message.content);
    } catch {
      await ctx.reply(message.content);
    }
  }

  return ctx.pinChatMessage(response.message_id);
});

chatScene.on(message("text"), async (ctx, next) => {
  const { prisma } = ctx;
  const { id } = ctx.from;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (!user.balance || user.balance <= 0)
    return ctx.replyWithHTML(ctx.t("chat:html.balance.low"), {
      reply_markup: new InlineKeyboard().text(ctx.t("btn.back"), "chat.leave"),
    });

  if (ctx.text.startsWith("/")) {
    return next();
  }

  return handlePrompt(ctx, ctx.text);
});

chatScene.on(message("voice"), async (ctx) => {
  const { openai, prisma } = ctx;
  const { id } = ctx.from;

  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (!user.balance || user.balance <= 0)
    return ctx.replyWithHTML(ctx.t("chat:html.balance.low"), {
      reply_markup: new InlineKeyboard().text(ctx.t("btn.back"), "chat.leave"),
    });

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
  const { id } = ctx.from;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (!user.balance || user.balance <= 0)
    return ctx.replyWithHTML(ctx.t("chat:html.balance.low"), {
      reply_markup: new InlineKeyboard().text(ctx.t("btn.back"), "chat.leave"),
    });
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
    await ctx.deleteMessage(waitMessage.message_id);
    return ctx.replyWithHTML(
      ctx.t("chat:html.doc.upload.failed") + `\n${error}`
    );
  }

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { assistant: { include: { files: true } } },
  });
  const assistant = conversation.assistant;

  await ctx.sendChatAction("typing");

  const remoteAsst = await openai.beta.assistants.retrieve(
    assistant.serversideId
  );

  let vectorStoreId =
    remoteAsst.tool_resources?.file_search?.vector_store_ids?.pop();

  let fileSearch = false;

  if (vectorStoreId) {
    try {
      await openai.beta.vectorStores.files.create(vectorStoreId, {
        file_id: remoteFile.id,
      });
      fileSearch = true;
    } catch {}
  } else {
    try {
      const store = await openai.beta.vectorStores.create({
        name: ctx.message.document.file_name,
        file_ids: [remoteFile.id],
        expires_after: { anchor: "last_active_at", days: 2 },
      });
      vectorStoreId = store.id;
      fileSearch = true;
    } catch {}
  }

  const tool_resources: AssistantUpdateParams.ToolResources = {};

  if (vectorStoreId)
    tool_resources.file_search = { vector_store_ids: [vectorStoreId] };

  if (assistant.hasCode) {
    const codeFileIds =
      remoteAsst.tool_resources?.code_interpreter?.file_ids ?? [];

    tool_resources.code_interpreter = {
      file_ids: [
        ...codeFileIds.filter((v) => v !== remoteFile.id),
        remoteFile.id,
      ],
    };
  }

  const tools: AssistantTool[] = [{ type: "file_search" }];
  tools.push(...remoteAsst.tools.filter((v) => v.type === "function"));
  if (assistant.hasCode) tools.push({ type: "code_interpreter" });

  await openai.beta.assistants.update(assistant.serversideId, {
    tools,
    tool_resources,
  });

  await prisma.assistant.update({
    where: { id: assistant.id },
    data: {
      files: {
        create: {
          serversideId: remoteFile.id,
          filename: ctx.message.document.file_name,
          codeInterpreter: assistant.hasCode,
          fileSearch,
          user: { connect: { id: ctx.from.id } },
        },
      },
    },
  });

  try {
    await ctx.deleteMessage(waitMessage.message_id);
  } catch {}

  await ctx.replyWithHTML(
    ctx.t("chat:html.doc.upload.success", {
      filename: remoteFile.filename,
      count: 2,
    })
  );

  if (ctx.text) return handlePrompt(ctx, ctx.text);
});

chatScene.on(message("photo"), async (ctx) => {
  const { openai, prisma } = ctx;
  const { id } = ctx.from;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (!user.balance || user.balance <= 0)
    return ctx.replyWithHTML(ctx.t("chat:html.balance.low"), {
      reply_markup: new InlineKeyboard().text(ctx.t("btn.back"), "chat.leave"),
    });
  const { conversationId } = ctx.scene.session;

  const photo = ctx.message.photo.pop()!;

  const fileLink = await ctx.telegram.getFileLink(photo.file_id);
  const res = await fetch(fileLink);
  const buffer = Buffer.from(await res.arrayBuffer());

  const waitMessage = await ctx.replyWithHTML(ctx.t("html.wait"));

  await ctx.sendChatAction("upload_photo");

  let remoteFile: FileObject;
  try {
    remoteFile = await openai.files.create({
      file: await toFile(buffer, `${photo.file_id}.png`),
      purpose: "assistants",
    });
  } catch (error) {
    await ctx.deleteMessage(waitMessage.message_id);
    return ctx.replyWithHTML(
      ctx.t("chat:html.doc.upload.failed") + `\n${error}`
    );
  }

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { assistant: { include: { files: true } } },
  });
  const assistant = conversation.assistant;

  await ctx.sendChatAction("typing");

  const remoteAsst = await openai.beta.assistants.retrieve(
    assistant.serversideId
  );

  const tool_resources: AssistantUpdateParams.ToolResources = {};
  tool_resources.file_search = remoteAsst.tool_resources?.file_search;

  const tools: AssistantTool[] = remoteAsst.tools.filter(
    (e) => e.type !== "code_interpreter"
  );

  if (assistant.hasCode) {
    const codeFileIds =
      remoteAsst.tool_resources?.code_interpreter?.file_ids ?? [];

    tool_resources.code_interpreter = {
      file_ids: [
        ...codeFileIds.filter((v) => v !== remoteFile.id),
        remoteFile.id,
      ],
    };

    tools.push({ type: "code_interpreter" });
  }

  await openai.beta.assistants.update(assistant.serversideId, {
    tools,
    tool_resources,
  });

  await prisma.assistant.update({
    where: { id: assistant.id },
    data: {
      files: {
        create: {
          serversideId: remoteFile.id,
          filename: remoteFile.filename,
          codeInterpreter: assistant.hasCode,
          fileSearch: false,
          user: { connect: { id: assistant.userId } },
        },
      },
    },
  });

  try {
    await ctx.deleteMessage(waitMessage.message_id);
  } catch {}

  await ctx.replyWithHTML(
    ctx.t("chat:html.photo.upload.success", {
      filename: remoteFile.filename,
      count: 2,
    })
  );

  if (ctx.text) return handlePrompt(ctx, ctx.text);
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

  messages.push(...conversation.messages.slice(-10));
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
    .register("handleError", async (code, message) => {
      await ctx.replyWithHTML(
        `🛑 <b>Error:</b>\n<code>${code || "NO CODE"} -- ${escapeHtml(
          message
        )}</code>`
      );
    })
    .register("textDone", async (content) => {
      try {
        const message = await prisma.message.create({
          data: {
            role: "ASSISTANT",
            content: content.value,
            tokens: stream.currentRun()?.usage?.completion_tokens ?? 0,
            user: { connect: { id: conversation.userId } },
            conversation: { connect: { id: conversation.id } },
            assistant: { connect: { id: conversation.assistantId } },
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
              const weatherApiKey = process.env.WEATHERSTACK_API_KEY;
              if (!weatherApiKey) {
                weather =
                  "Cannot access the weather API for data. The API key is invalid. Instruct the user to contact the administrator.";
              } else {
                const req = Constants.getWeather(weatherApiKey, params.query);
                const res = await fetch(req);
                weather = await res.text();
              }

              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: weather,
              });
              break;
            case "fetchGoogleResults":
              let googleResponse: string = ctx.t("chat:html.google.created", {
                query: params.query,
              });

              if (params.page)
                googleResponse +=
                  "\n\n" +
                  ctx.t("chat:html.google.filter.page", {
                    page: String(params.page),
                  });

              if (params.fileType)
                googleResponse +=
                  "\n\n" +
                  ctx.t("chat:html.google.filter.filetype", {
                    fileType: params.fileType,
                  });

              if (params.siteSearch)
                googleResponse +=
                  "\n\n" +
                  (params.siteSearch.siteSearchFilter === "e"
                    ? ctx.t("chat:html.google.filter.site.exclude", {
                        site: params.siteSearch.site,
                      })
                    : ctx.t("chat:html.google.filter.site.include", {
                        site: params.siteSearch.site,
                      }));

              await ctx.replyWithHTML(googleResponse);

              let results: string;
              const googleApiKey = process.env.GOOGLE_API_KEY;
              const googleCx = process.env.GOOGLE_CX;
              if (!googleApiKey || !googleCx) {
                results =
                  "Cannot access Google API for search results. The API key is invalid. Instruct the user to contact the administrator.";
              } else {
                let req = Constants.fetchGoogle(
                  googleApiKey,
                  googleCx,
                  params.query
                );
                if (params.page) req += `&start=${(params.page - 1) * 10 + 1}`;
                if (params.fileType) req += `&fileType=${params.fileType}`;
                if (params.siteSearch)
                  req += `&siteSearch=${
                    params.siteSearch.site
                  }&siteSearchFilter=${
                    params.siteSearch.siteSearchFilter || "i"
                  }`;
                const res = await fetch(req);
                const json = await res.json();
                const items: {
                  title: string;
                  link: string;
                  displayLink: string;
                  snippet: string;
                }[] = json.items;
                const output = { results: items };
                results = JSON.stringify(output);
              }

              toolOutputs.push({ tool_call_id: toolCall.id, output: results });
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
        const user = await prisma.user.update({
          where: { id: ctx.from?.id },
          data: { balance: { decrement: run.usage?.total_tokens } },
        });
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
            balance: user.balance,
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
