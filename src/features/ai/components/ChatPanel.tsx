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
} from "@phosphor-icons/react";

import { Textarea } from "@/shared/components/ui/textarea";
import { useAI, getMessageText } from "@/shared/hooks/useAI";
import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore } from "@/shared/stores/editor";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { extractFirstCodeBlock } from "@/shared/lib/extract-code-block";
import type { UIMessage } from "@ai-sdk/react";

import { AiModelSelector } from "./AiModelSelector";
import { ChatSessionList } from "./ChatSessionList";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { ContextPicker, type ContextPickerRef } from "./ContextPicker";
import { Conversation, ConversationContent, ConversationScrollButton } from "./Conversation";
import { Message, MessageContent, MessageResponse } from "./Message";
import { ReasoningBlock } from "./ReasoningBlock";
import { SourceBlock } from "./SourceBlock";

function extractInlineReasoning(text: string): { text: string; reasoning: string } {
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
    if (end === -1) continue;
    reasoning += cleaned.slice(start + open.length, end).trim() + "\n\n";
    cleaned = cleaned.slice(0, start) + cleaned.slice(end + close.length);
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
    sessionId,
    createChatSession,
  } = useAI();
  const { cliStatuses, activeChatSessionId, chatSessions } = useAIStore();
  const { edit, prefillPrompt, consumePrefill, receiveProposal, cancelEdit } = useAIEditStore();
  const openDiff = useEditorStore((state) => state.openDiff);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const contextPickerRef = useRef<ContextPickerRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (contextPickerRef.current?.handleKeyDown(e)) {
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (input.trim() && !isLoading) {
          void handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
        }
      }
    },
    [input, isLoading, handleSubmit],
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
    createChatSession();
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
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/40 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ChatTeardropText size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            {activeSession?.title ?? "Chat"}
          </span>
          <span className="text-ui-xs text-muted-foreground/60 font-mono shrink-0">
            {sessionId.slice(0, 12)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <AiModelSelector />
          <ChatSessionList />
          <button
            onClick={handleNewSession}
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
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
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <PaperPlaneRight size={20} weight="bold" className="text-primary" />
                </div>
                <p className="text-sm font-medium">Pragma AI</p>
                <p className="text-sm text-muted-foreground mt-1">How can I help you today?</p>

                {!canChat && (
                  <p className="mt-4 text-xs text-muted-foreground">
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
              const isStreaming = msg.id === streamingMessageId;

              // Some providers/models emit reasoning as inline <thinking> tags inside the text.
              const { text, reasoning: inlineReasoning } = extractInlineReasoning(rawText);
              const reasoning = reasoningParts || inlineReasoning;

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
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Robot size={14} className="text-muted-foreground" />
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
                    <MessageResponse streaming={isStreaming}>{text}</MessageResponse>
                    {isStreaming && (
                      <span className="mt-2 inline-flex h-4 items-center">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                      </span>
                    )}
                  </MessageContent>
                </Message>
              );
            })}

            {status === "submitted" && (
              <Message from="assistant">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Robot size={14} className="text-muted-foreground" />
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
      <div className="shrink-0 border-t border-border/60 p-3">
        {/* Error Banner */}
        {error && (
          <div className="mb-2 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-ui-sm text-destructive">
            <Warning size={14} className="mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">Something went wrong</p>
              <p className="mt-0.5 break-words">{error.message}</p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 hover:bg-destructive/15"
            >
              <ArrowCounterClockwise size={12} weight="bold" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Status Banner */}
        {isCLIActive && cliStatus && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-ui-sm text-primary">
            <Terminal size={14} />
            <span>
              Using {cliStatus.provider_id} via CLI
              {cliStatus.user && ` — ${cliStatus.user}`}
            </span>
          </div>
        )}

        {!canChat && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-status-warning/10 px-3 py-2 text-ui-sm text-status-warning">
            <Warning size={14} />
            <span>
              {isCLIActive
                ? "CLI provider not authenticated. Please reconnect."
                : "No AI provider configured. Add an API key in Settings or connect a CLI subscription."}
            </span>
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
              className="min-h-[36px] resize-none py-2 text-ui-base"
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
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              <Stop size={16} weight="bold" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !canChat}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:hover:bg-primary"
            >
              <PaperPlaneRight size={16} weight="bold" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
