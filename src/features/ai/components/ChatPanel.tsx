import { useRef, useEffect, useCallback, useState } from "react";
import {
  PaperPlaneRight,
  Warning,
  Terminal,
  Plus,
  ChatTeardropText,
  Stop,
  Robot,
  ArrowCounterClockwise,
  Check,
  X,
} from "@phosphor-icons/react";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Textarea } from "@/shared/components/ui/textarea";
import { useAI, getMessageText } from "@/shared/hooks/useAI";
import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore } from "@/shared/stores/editor";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import { extractFirstCodeBlock } from "@/shared/lib/extract-code-block";
import { matchShortcut } from "@/shared/lib/shortcuts";
import type { UIMessage } from "@ai-sdk/react";

import { AiModelSelector } from "./AiModelSelector";
import { ChatSessionList } from "./ChatSessionList";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { ContextPicker, type ContextPickerRef } from "./ContextPicker";
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
    handleInputChange,
    handleSubmit,
    isLoading,
    status,
    error,
    regenerate,
    stop,
    canChat,
    isCLIActive,
    activeCLIProvider,
    createChatSession,
    mcpLoaded,
  } = useAI();
  const { cliStatuses, activeChatSessionId, chatSessions } = useAIStore();
  const { edit, prefillPrompt, consumePrefill, receiveProposal, cancelEdit } = useAIEditStore();
  const openDiff = useEditorStore((state) => state.openDiff);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const contextPickerRef = useRef<ContextPickerRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);
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
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);

  const previousStatusRef = useRef(status);

  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    if (!prefillPrompt) return;
    if (inputRef.current !== prefillPrompt) {
      setInput(prefillPrompt);
    }
    consumePrefill();
  }, [prefillPrompt, setInput, consumePrefill]);

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

  const sendShortcut = useSettingsStore((s) => s.shortcuts["chat.send"]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (contextPickerRef.current?.handleKeyDown(e)) {
        return;
      }

      if (matchShortcut(e, sendShortcut)) {
        e.preventDefault();
        if (input.trim() && !isLoading) {
          void handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
        }
      }
    },
    [input, isLoading, handleSubmit, sendShortcut],
  );

  const updateCursorPosition = useCallback(() => {
    const position = textareaRef.current?.selectionStart ?? 0;
    setCursorPosition(position);
  }, []);

  const handleInputChangeWithCursor = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange(e);
      setCursorPosition(e.target.selectionStart);
    },
    [handleInputChange],
  );

  const handleContextSelect = useCallback(
    (value: string, position: number) => {
      setInput(value);
      setCursorPosition(position);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(position, position);
        }
      });
    },
    [setInput],
  );

  const handleNewSession = useCallback(() => {
    void createChatSession();
  }, [createChatSession]);

  const handleRetry = useCallback(() => {
    void regenerate();
  }, [regenerate]);

  const streamingMessageId =
    status === "streaming" && messages[messages.length - 1]?.role === "assistant"
      ? messages[messages.length - 1]?.id
      : null;

  return (
    <div className="flex h-full flex-col">
      {/* Session Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <ChatTeardropText size={14} className="shrink-0 text-fg-muted" />
          <span className="truncate text-ui-xs text-fg-muted">
            {activeSession?.title ?? "Chat"}
          </span>
          {activeSession && (
            <span className="shrink-0 text-ui-xs text-fg-subtle">
              {new Date(activeSession.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <AiModelSelector />
          <ChatSessionList />
          <button
            onClick={handleNewSession}
            className="flex size-6 shrink-0 items-center justify-center rounded-sm text-fg-muted outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.92]"
            title="New Session"
          >
            <Plus size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <Conversation className="h-full">
          <ConversationContent className="gap-4 p-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent-subtle">
                  <PaperPlaneRight size={20} weight="bold" className="text-primary" />
                </div>
                <p className="text-ui-sm font-semibold">Pragma AI</p>
                <p className="mt-1 text-ui-sm text-fg-muted">How can I help you today?</p>

                {!canChat && (
                  <p className="mt-4 text-ui-xs text-fg-subtle">
                    Open Settings to configure an AI provider.
                  </p>
                )}
              </div>
            )}

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

              // Some providers/models emit reasoning as inline <thinking> tags inside the text.
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
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-bg-hover">
                    <Robot size={14} className="text-fg-muted" />
                  </div>
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
                    {reasoning && <ReasoningBlock reasoning={reasoning} streaming={isStreaming} />}
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
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-hover">
                  <Robot size={14} className="text-fg-muted" />
                </div>
                <MessageContent>
                  <ChatTypingIndicator />
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-border bg-bg-surface p-3">
        {/* Error Banner */}
        {error && (
          <div className="mb-2 flex items-start gap-2 rounded-sm bg-[color-mix(in_srgb,var(--color-status-error)_10%,transparent)] px-3 py-2 text-ui-sm text-status-error">
            <Warning size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Something went wrong</p>
              <p className="mt-0.5 break-words">{error.message}</p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="flex shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-fg-default outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-[color-mix(in_srgb,var(--color-status-error)_15%,transparent)] focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]"
            >
              <ArrowCounterClockwise size={12} weight="bold" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Status Banner */}
        {isCLIActive && cliStatus && (
          <div className="mb-2 flex items-center gap-2 rounded-sm bg-accent-subtle px-3 py-2 text-ui-sm text-primary">
            <Terminal size={14} />
            <span>
              Using {cliStatus.provider_id} via CLI
              {cliStatus.user && ` — ${cliStatus.user}`}
            </span>
          </div>
        )}

        {!canChat && (
          <div className="mb-2 flex items-center gap-2 rounded-sm bg-[color-mix(in_srgb,var(--color-status-warning)_10%,transparent)] px-3 py-2 text-ui-sm text-status-warning">
            <Warning size={14} />
            <span>
              {isCLIActive
                ? "CLI provider not authenticated. Please reconnect."
                : "No AI provider configured. Add an API key in Settings or connect a CLI subscription."}
            </span>
          </div>
        )}

        {!mcpLoaded && (
          <div className="mb-2 flex items-center gap-2 rounded-sm bg-[color-mix(in_srgb,var(--color-accent-subtle)_50%,transparent)] px-3 py-1.5 text-ui-xs text-fg-subtle">
            <Robot size={12} className="animate-pulse" />
            <span>Loading MCP tools...</span>
          </div>
        )}

        {pendingApprovals.length > 0 && (
          <div className="mb-2 flex flex-col gap-2">
            {pendingApprovals.map((approval) => (
              <div
                key={approval.toolCallId}
                className="flex flex-col gap-2 rounded-sm border border-border bg-bg-root p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-ui-sm font-medium">Allow tool: {approval.toolName}</span>
                </div>
                {approval.description && (
                  <p className="text-ui-xs text-fg-muted">{approval.description}</p>
                )}
                {approval.args ? (
                  <pre className="max-h-32 overflow-auto rounded-sm bg-bg-surface p-2 text-ui-xs text-fg-muted">
                    {JSON.stringify(approval.args, null, 2)}
                  </pre>
                ) : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleApproval(approval.toolCallId, false)}
                    className="flex items-center gap-1 rounded-sm bg-status-error px-3 py-1.5 text-ui-xs text-fg-inverse outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-[color-mix(in_srgb,var(--color-status-error)_90%,transparent)] focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]"
                  >
                    <X size={12} weight="bold" />
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApproval(approval.toolCallId, true)}
                    className="flex items-center gap-1 rounded-sm bg-status-success px-3 py-1.5 text-ui-xs text-fg-inverse outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-[color-mix(in_srgb,var(--color-status-success)_90%,transparent)] focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.98]"
                  >
                    <Check size={12} weight="bold" />
                    Allow
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChangeWithCursor}
              onKeyDown={onKeyDown}
              onKeyUp={updateCursorPosition}
              onClick={updateCursorPosition}
              onSelect={updateCursorPosition}
              placeholder={canChat ? "Ask anything..." : "Configure a provider first..."}
              rows={1}
              className="min-h-9 resize-none py-2 text-ui-base"
              disabled={!canChat || isLoading}
            />
            <ContextPicker
              ref={contextPickerRef}
              input={input}
              cursorPosition={cursorPosition}
              rootPath={rootPath}
              onSelect={handleContextSelect}
            />
          </div>
          {status === "streaming" ? (
            <button
              type="button"
              onClick={stop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-status-error text-fg-inverse outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-[color-mix(in_srgb,var(--color-status-error)_90%,transparent)] focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.92]"
            >
              <Stop size={16} weight="bold" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !canChat || !mcpLoaded}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] hover:bg-[color-mix(in_srgb,var(--color-primary)_90%,transparent)] focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.92] disabled:opacity-40 disabled:hover:bg-primary"
            >
              <PaperPlaneRight size={16} weight="bold" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
