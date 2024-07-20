import EventEmitter from "events";
import OpenAI from "openai";
import { AssistantStream } from "openai/lib/AssistantStream";
import { AssistantStreamEvent } from "openai/resources/beta/assistants";
import { Text } from "openai/resources/beta/threads/messages";
import {
  RequiredActionFunctionToolCall,
  Run,
  RunSubmitToolOutputsParams,
} from "openai/resources/beta/threads/runs/runs";
import { ToolCall } from "openai/resources/beta/threads/runs/steps";

interface CompletionEvents {
  textDone?: (text: Text) => Promise<void>;
  imageDone?: (image: Buffer | string) => Promise<void>;
  toolCallsDone?: (toolCalls: ToolCall[]) => Promise<void>;
  toolCallsAction?: (
    toolCalls: RequiredActionFunctionToolCall[]
  ) => Promise<RunSubmitToolOutputsParams.ToolOutput[]>;
  runCompleted?: (runId: string, threadId: string) => Promise<void>;
  handleError?: (code: string | null, message: string) => Promise<void>;
}

class OpenAIEventHandler extends EventEmitter {
  private client: OpenAI;
  private handlers: CompletionEvents = {};

  constructor(client: OpenAI) {
    super();
    this.client = client;
    this.on("event", this.onEvent.bind(this));
  }

  register<Event extends keyof CompletionEvents>(
    event: Event,
    listener: CompletionEvents[Event]
  ): OpenAIEventHandler {
    this.handlers[event] = listener;
    return this;
  }

  async observe(stream: AssistantStream) {
    for await (const event of stream) this.emit("event", event);
  }

  private async onEvent(event: AssistantStreamEvent) {
    try {
      // console.log(event);
      // Retrieve events that are denoted with 'requires_action'
      // since these will have our tool_calls
      switch (event.event) {
        case "thread.run.requires_action":
          await this.handleRequiresAction(event.data);
          break;
        case "thread.message.completed":
          for (const content of event.data.content) {
            switch (content.type) {
              case "text":
                this.handleTextDone(content.text);
                break;
              case "image_file":
                const res = await this.client.files.content(
                  content.image_file.file_id
                );
                const buffer = Buffer.from(await res.arrayBuffer());
                this.handleImageDone(buffer);
                break;
              case "image_url":
                this.handleImageDone(content.image_url.url);
                break;
            }
          }
          break;
        case "thread.run.step.completed":
          switch (event.data.step_details.type) {
            case "tool_calls":
              await this.handleToolCallsDone(
                event.data.step_details.tool_calls
              );
              break;
            case "message_creation":
              break;
          }
          break;
        case "thread.run.completed":
          this.handleRunCompleted(event.data.id, event.data.thread_id);
          break;
        case "error":
          this.handleError(event.data.code, event.data.message);
          break;
        case "thread.run.failed":
          this.handleError(
            event.data.last_error?.code || null,
            event.data.last_error?.message || "No message"
          );
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("Error handling event:", error);
    }
  }

  private async handleRunCompleted(runId: string, threadId: string) {
    if (this.handlers.runCompleted)
      await this.handlers.runCompleted(runId, threadId);
  }

  private async handleTextDone(text: Text) {
    if (this.handlers.textDone) await this.handlers.textDone(text);
  }

  private async handleImageDone(image: Buffer | string) {
    if (this.handlers.imageDone) await this.handlers.imageDone(image);
  }

  private async handleToolCallsDone(toolCalls: ToolCall[]) {
    if (this.handlers.toolCallsDone)
      await this.handlers.toolCallsDone(toolCalls);
  }

  private async handleError(code: string | null, message: string) {
    if (this.handlers.handleError)
      await this.handlers.handleError(code, message);
  }

  private async handleRequiresAction(run: Run) {
    try {
      const toolOutputs = this.handlers.toolCallsAction
        ? await this.handlers.toolCallsAction(
            run.required_action?.submit_tool_outputs.tool_calls ?? []
          )
        : [];
      // Submit all the tool outputs at the same time
      await this.submitToolOutputs(toolOutputs, run.id, run.thread_id);
    } catch (error) {
      console.error("Error processing required action:", error);
    }
  }

  private async submitToolOutputs(
    toolOutputs: RunSubmitToolOutputsParams.ToolOutput[],
    runId: string,
    threadId: string
  ) {
    try {
      // Use the submitToolOutputsStream helper
      const stream = this.client.beta.threads.runs
        // this.client.beta.threads.runs
        .submitToolOutputsStream(threadId, runId, {
          tool_outputs: toolOutputs,
        });
      // .on("event", (event) => this.emit("event", event));
      // for await (const event of stream) {
      //   this.emit("event", event);
      // }
      await this.observe(stream);
    } catch (error) {
      console.error("Error submitting tool outputs:", error);
    }
  }
}

export default OpenAIEventHandler;
