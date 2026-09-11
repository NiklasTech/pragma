import { useRef, useEffect, useCallback, useState } from "react";
import { Warning, Terminal, Robot, ArrowCounterClockwise, Check, X } from "@phosphor-icons/react";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useAI, getMessageText } from "@/shared/hooks/useAI";
import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { extractFirstCodeBlock } from "@/shared/lib/extract-code-block";
import type { UIMessage } from "@ai-sdk/react";

import { AgentApprovals } from "@/features/agent/components/AgentApprovals";
import { AgentRunBar } from "./AgentRunBar";
import { ChatComposer } from "./ChatComposer";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatPanelHeader } from "./ChatPanelHeader";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { Conversation, ConversationContent, ConversationScrollButton } from "./Conversation";
import { Message, MessageContent, MessageResponse } from "./Message";
import { ReasoningBlock } from "./ReasoningBlock";
import { SourceBlock } from "./SourceBlock";
import { ToolInvocationBlock } from "./ToolInvocationBlock";

function extractInlineReasoning(
  text: string,
  streaming = false,
): { text: string; reasoning: string } {
  const tags = [
    { open: "<thinking>", close: "</thinking>" },
    { open: "<reasoning>", close: "</reasoning>" },
    { open: "<think>", close: "</think>" },
  ];

  let reasoning = "";
  let cleaned = text;

  for (const { open, close } of tags) {
    const start = cleaned.indexOf(open);
    if (start === -1) continue;
    const end = cleaned.indexOf(close, start + open.length);
    if (end !== -1) {
      reasoning += cleaned.slice(start + open.length, end).trim() + "\n\n";
      cleaned = cleaned.slice(0, start) + cleaned.slice(end + close.length);
    } else if (streaming) {
      reasoning += cleaned.slice(start + open.length).trim();
      cleaned = cleaned.slice(0, start);
    }
  }

  return { text: cleaned.trim(), reasoning: reasoning.trim() };
}

export function ChatPanel() {
  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    status,
    error,
    regenerate,
    stop,
    canChat,
    isCLIActive,
    activeCLIProvider,
    mcpLoaded,
  } = useAI();
  const { cliStatuses } = useAIStore();
  const { edit, receiveProposal, cancelEdit } = useAIEditStore();
  const openDiff = useEditorStore((state) => state.openDiff);
  const yoloMode = useSettingsStore((state) => state.ai.yoloMode);
  const showThinking = useSettingsStore((state) => state.ai.showThinking);
  const [pendingApprovals, setPendingApprovals] = useState<
    Array<{
      sessionId: string;
      toolCallId: string;
      toolName: string;
      args?: unknown;
      description?: string;
    }>
  >([]);

  const cliStatus = activeCLIProvider ? cliStatuses[activeCLIProvider] : null;

  const previousStatusRef = useRef(status);

  useEffect(() => {
    const previous = previousStatusRef.current;
    previousStatusRef.current = status;

    if (
      (previous === "streaming" || previous === "submitted") &&
      status === "ready" &&
      edit?.status === "awaiting"
    ) {
      const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
      if (!lastAssistant) {
        cancelEdit();
        return;
      }

      const text = getMessageText(lastAssistant);
      const codeBlock = extractFirstCodeBlock(text);

      if (!codeBlock) {
        cancelEdit();
        return;
      }

      receiveProposal(codeBlock.code);

      const fileName = edit.filePath.split("/").pop() ?? edit.filePath;
      openDiff({
        id: `ai-edit:${edit.fileTabId}:${Date.now()}`,
        path: edit.filePath,
        original: edit.originalCode,
        modified: codeBlock.code,
        patchText: "",
        staged: false,
        sourceTabId: edit.fileTabId,
        name: `${fileName} (AI Edit)`,
      });
    }
  }, [status, edit, messages, receiveProposal, cancelEdit, openDiff]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;

    void (async () => {
      unlisten = await listen<
        Array<{
          sessionId: string;
          toolCallId: string;
          toolName: string;
          args?: unknown;
          description?: string;
        }>[number]
      >("acp_request_permission", (event) => {
        setPendingApprovals((prev) => [...prev, event.payload]);
      });
      if (!active) {
        unlisten();
        unlisten = undefined;
      }
    })();

    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const handleApproval = useCallback(async (toolCallId: string, approved: boolean) => {
    await invoke("cli_acp_approve", { req: { tool_call_id: toolCallId, approved } });
    setPendingApprovals((prev) => prev.filter((a) => a.toolCallId !== toolCallId));
  }, []);

  // Auto-approve pending tool requests when Yolo mode is enabled.
  useEffect(() => {
    if (!yoloMode || pendingApprovals.length === 0) return;

    for (const approval of pendingApprovals) {
      void handleApproval(approval.toolCallId, true);
    }
  }, [yoloMode, pendingApprovals, handleApproval]);

  const handleRetry = useCallback(() => {
    void regenerate();
  }, [regenerate]);

  const streamingMessageId =
    status === "streaming" && messages[messages.length - 1]?.role === "assistant"
      ? messages[messages.length - 1]?.id
      : null;

  const cliStatusText = cliStatus
    ? `Using ${cliStatus.provider_id} via CLI${cliStatus.user ? ` — ${cliStatus.user}` : ""}`
    : "";

  return (
    <div className="@container flex h-full flex-col">
      <ChatPanelHeader />

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <Conversation className="h-full">
          <ConversationContent className="gap-5 px-4 py-5">
            {messages.length === 0 && <ChatEmptyState />}

            {messages.map((msg: UIMessage) => {
              const reasoningParts = msg.parts
                .filter((p) => p.type === "reasoning")
                .map((p) => (p as { text: string }).text)
                .join("");
              const rawText = msg.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");
              const sourceDocuments = msg.parts.filter(
                (p) => p.type === "source-document",
              ) as Array<{
                type: "source-document";
                title: string;
                filename?: string;
              }>;
              const sourceUrls = msg.parts.filter((p) => p.type === "source-url") as Array<{
                type: "source-url";
                url: string;
                title?: string;
              }>;
              const toolInvocations = msg.parts
                .map((p) => {
                  if (p.type === "tool-invocation" && "toolInvocation" in p) {
                    return (p as { toolInvocation: unknown }).toolInvocation as {
                      state:
                        | "input-streaming"
                        | "input-available"
                        | "output-streaming"
                        | "output-available"
                        | "output-error";
                      toolCallId: string;
                      toolName: string;
                      input: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                  }
                  if (
                    p.type === "dynamic-tool" ||
                    (typeof p.type === "string" && p.type.startsWith("tool-"))
                  ) {
                    const part = p as {
                      state:
                        | "input-streaming"
                        | "input-available"
                        | "output-streaming"
                        | "output-available"
                        | "output-error";
                      toolCallId: string;
                      toolName: string;
                      input: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    return part;
                  }
                  return null;
                })
                .filter((inv): inv is NonNullable<typeof inv> => inv !== null);
              const isStreaming = msg.id === streamingMessageId;

              const { text, reasoning: inlineReasoning } = extractInlineReasoning(
                rawText,
                isStreaming,
              );
              const reasoning = reasoningParts
                ? `${reasoningParts}\n\n${inlineReasoning}`.trim()
                : inlineReasoning;

              if (msg.role === "user") {
                return (
                  <Message key={msg.id} from="user">
                    <MessageContent>
                      <p className="whitespace-pre-wrap wrap-break-word">{rawText}</p>
                    </MessageContent>
                  </Message>
                );
              }

              return (
                <Message key={msg.id} from="assistant">
                  <MessageContent>
                    {sourceDocuments.map((source, index) => (
                      <SourceBlock
                        key={`${msg.id}-doc-${index}`}
                        type="document"
                        title={source.title}
                        filename={source.filename}
                        streaming={isStreaming}
                      />
                    ))}
                    {sourceUrls.map((source, index) => (
                      <SourceBlock
                        key={`${msg.id}-url-${index}`}
                        type="url"
                        title={source.title ?? source.url}
                        url={source.url}
                        streaming={isStreaming}
                      />
                    ))}
                    {reasoning && showThinking && (
                      <ReasoningBlock reasoning={reasoning} streaming={isStreaming} />
                    )}
                    {toolInvocations.map((inv) => (
                      <ToolInvocationBlock
                        key={inv.toolCallId}
                        toolCallId={inv.toolCallId}
                        toolName={inv.toolName}
                        state={inv.state}
                        input={inv.input}
                        output={inv.output}
                        errorText={inv.errorText}
                      />
                    ))}
                    <MessageResponse streaming={isStreaming}>{text}</MessageResponse>
                    {isStreaming && (
                      <span className="mt-2 inline-flex h-4 items-center">
                        <span className="size-1.5 animate-pulse rounded-full bg-fg-muted" />
                      </span>
                    )}
                  </MessageContent>
                </Message>
              );
            })}

            {status === "submitted" && (
              <Message from="assistant">
                <MessageContent>
                  <ChatTypingIndicator />
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-2 pb-2">
        {/* Error Banner */}
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg bg-status-error/10 px-3 py-2 text-ui-sm text-status-error">
            <Warning size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Something went wrong</p>
              <p className="mt-0.5 break-words">{error.message}</p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 hover:bg-status-error/15"
            >
              <ArrowCounterClockwise size={12} weight="bold" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Status Banner */}
        {isCLIActive && cliStatus && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent-subtle px-3 py-2 text-ui-sm text-primary">
            <Terminal size={14} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate" title={cliStatusText}>
              {cliStatusText}
            </span>
          </div>
        )}

        {!mcpLoaded && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent-subtle/50 px-3 py-1.5 text-ui-xs text-fg-subtle">
            <Robot size={12} className="animate-pulse" />
            <span>Loading MCP tools...</span>
          </div>
        )}

        {pendingApprovals.length > 0 && (
          <div className="mb-3 flex flex-col gap-2">
            {pendingApprovals.map((approval) => (
              <div
                key={approval.toolCallId}
                className="flex flex-col gap-2 rounded-lg border border-border bg-bg-root p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-ui-sm font-medium">Allow tool: {approval.toolName}</span>
                </div>
                {approval.description && (
                  <p className="text-ui-xs text-fg-muted">{approval.description}</p>
                )}
                {approval.args ? (
                  <pre className="max-h-32 overflow-auto rounded-md bg-bg-surface p-2 text-ui-xs text-fg-muted">
                    {JSON.stringify(approval.args, null, 2)}
                  </pre>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleApproval(approval.toolCallId, false)}
                    className="flex items-center gap-1 rounded-md bg-status-error px-3 py-1.5 text-ui-xs text-fg-inverse hover:bg-status-error/90"
                  >
                    <X size={12} weight="bold" />
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproval(approval.toolCallId, true)}
                    className="flex items-center gap-1 rounded-md bg-status-success px-3 py-1.5 text-ui-xs text-fg-inverse hover:bg-status-success/90"
                  >
                    <Check size={12} weight="bold" />
                    Allow
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <AgentApprovals />

        <AgentRunBar />

        <ChatComposer
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          isStreaming={status === "streaming"}
          canChat={canChat}
          mcpLoaded={mcpLoaded}
          onStop={stop}
        />
      </div>
    </div>
  );
}
