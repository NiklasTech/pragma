import { type ChatTransport, type UIMessage, type UIMessageChunk } from "ai";
import { Channel, invoke } from "@tauri-apps/api/core";

import { requestMessages } from "./compaction";
import { generateId } from "./id";
import { getMessageImages, toBackendImage } from "./images";
import {
  getMessageText,
  uiMessageToBackendMessages,
  withPendingContext,
  type AcpChatRequest,
  type APIChatRequest,
  type BackendToolDefinition,
  type CLIChatRequest,
  type StreamChunk,
  type StreamUsage,
} from "./protocol";

export function createStreamTransport(
  activeProvider: string,
  activeModel: string,
  baseUrl: string | undefined,
  isCLIActive: boolean,
  activeCLIProvider: string | null,
  tools: BackendToolDefinition[],
  rootPath: string,
  activeChatSessionId: string | null,
  isAcpActive: boolean,
  systemPrompt?: string,
  leadingSystemMessage?: string | null,
  consumePendingContext: () => string | null = () => null,
  allowChildSessions = false,
  mcpServerIds: string[] | null = null,
  onUsage: (usage: StreamUsage) => void = () => {},
): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages: transcript, abortSignal }) {
      const messages = requestMessages(transcript);
      const chunkId = generateId();
      const streamId = generateId();

      return new ReadableStream<UIMessageChunk>({
        start(controller) {
          let started = false;
          let closed = false;

          const safeEnqueue = (chunk: UIMessageChunk) => {
            if (!closed) {
              controller.enqueue(chunk);
            }
          };

          const safeClose = () => {
            if (!closed) {
              closed = true;
              controller.close();
            }
          };

          let hadToolCalls = false;
          let reasoningStarted = false;

          const finish = () => {
            if (reasoningStarted) {
              safeEnqueue({ type: "reasoning-end", id: chunkId });
            }
            safeEnqueue({ type: "text-end", id: chunkId });
            safeEnqueue({ type: "finish-step" });
            safeEnqueue({
              type: "finish",
              finishReason: hadToolCalls ? "tool-calls" : "stop",
            });
            safeClose();
          };

          const channel = new Channel<StreamChunk>();

          channel.onmessage = (chunk) => {
            // ACP agents report usage with the prompt response, which can follow the turn end.
            if (chunk.usage) onUsage(chunk.usage);
            if (closed) return;

            if (chunk.error) {
              safeEnqueue({ type: "error", errorText: chunk.error });
              safeClose();
              return;
            }

            if (!started) {
              started = true;
              safeEnqueue({ type: "start-step" });
              safeEnqueue({ type: "text-start", id: chunkId });
            }

            if (chunk.text) {
              safeEnqueue({ type: "text-delta", id: chunkId, delta: chunk.text });
            }

            if (chunk.reasoning) {
              if (!reasoningStarted) {
                reasoningStarted = true;
                safeEnqueue({ type: "reasoning-start", id: chunkId });
              }
              safeEnqueue({
                type: "reasoning-delta",
                id: chunkId,
                delta: chunk.reasoning,
              });
            }

            if (chunk.tool_calls && chunk.tool_calls.length > 0) {
              hadToolCalls = true;
              for (const call of chunk.tool_calls) {
                let input: unknown;
                try {
                  input = JSON.parse(call.function.arguments);
                } catch {
                  input = call.function.arguments;
                }

                safeEnqueue({
                  type: "tool-input-available",
                  toolCallId: call.id,
                  toolName: call.function.name,
                  input,
                });
              }
            }

            if (chunk.tool_results && chunk.tool_results.length > 0) {
              for (const result of chunk.tool_results) {
                if (result.is_error) {
                  safeEnqueue({
                    type: "tool-output-error",
                    toolCallId: result.tool_call_id,
                    errorText: result.output,
                  });
                } else {
                  safeEnqueue({
                    type: "tool-output-available",
                    toolCallId: result.tool_call_id,
                    output: result.output,
                  });
                }
              }
            }

            if (chunk.done) {
              finish();
            }
          };

          const abortHandler = () => {
            closed = true;
            try {
              controller.error(new Error("aborted"));
            } catch {
              // ignore
            }
            if (isAcpActive && activeChatSessionId) {
              void invoke("cli_acp_cancel", { req: { chat_session_id: activeChatSessionId } });
            } else if (!isCLIActive) {
              void invoke("cancel_ai_chat_stream", { req: { stream_id: streamId } });
            }
          };

          abortSignal?.addEventListener("abort", abortHandler);

          const send = async () => {
            try {
              const pendingContext = consumePendingContext();
              const cliMessages = (): { role: string; content: string }[] => {
                const base = withPendingContext(
                  messages.map((m: UIMessage) => ({
                    role: m.role,
                    content: getMessageText(m),
                  })),
                  pendingContext,
                );
                return leadingSystemMessage
                  ? [{ role: "system", content: leadingSystemMessage }, ...base]
                  : base;
              };
              if (isAcpActive && activeChatSessionId && activeCLIProvider) {
                const lastUser = [...messages].reverse().find((m: UIMessage) => m.role === "user");
                const images = lastUser ? getMessageImages(lastUser).map(toBackendImage) : [];
                const req: AcpChatRequest = {
                  provider_id: activeCLIProvider,
                  chat_session_id: activeChatSessionId,
                  cwd: rootPath,
                  messages: cliMessages(),
                  allow_child_sessions: allowChildSessions,
                  ...(mcpServerIds ? { mcp_server_ids: mcpServerIds } : {}),
                  ...(images.length > 0 ? { images } : {}),
                };
                await invoke("cli_acp_chat_stream", { req, channel });
              } else if (isCLIActive && activeCLIProvider) {
                const req: CLIChatRequest = {
                  provider_id: activeCLIProvider,
                  messages: cliMessages(),
                  session_id: generateId(),
                };
                await invoke("cli_chat_stream", { req, channel });
              } else {
                const req: APIChatRequest = {
                  provider: activeProvider,
                  model: activeModel,
                  base_url: baseUrl,
                  messages: [
                    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                    ...withPendingContext(
                      messages.flatMap(uiMessageToBackendMessages),
                      pendingContext,
                    ),
                  ],
                  stream_id: streamId,
                  tools: tools.length > 0 ? tools : undefined,
                };
                await invoke("ai_chat_stream", { req, channel });
              }

              if (!started) {
                safeEnqueue({ type: "start-step" });
                safeEnqueue({ type: "text-start", id: chunkId });
              }
              finish();
            } catch (err) {
              if (String(err).includes("aborted")) {
                safeClose();
              } else {
                safeEnqueue({ type: "error", errorText: String(err) });
                safeClose();
              }
            } finally {
              abortSignal?.removeEventListener("abort", abortHandler);
            }
          };

          void send();
        },
      });
    },

    async reconnectToStream() {
      return null;
    },
  };
}
