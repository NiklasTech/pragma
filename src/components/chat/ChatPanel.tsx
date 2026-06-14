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

import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAI } from "@/hooks/useAI";
import { useAIStore } from "@/stores/ai";
import { useFileExplorerStore } from "@/stores/fileExplorer";
import type { UIMessage } from "@ai-sdk/react";

import { AiModelSelector } from "./AiModelSelector";
import { ChatMessage } from "./ChatMessage";
import { ChatSessionList } from "./ChatSessionList";
import { ChatTypingIndicator } from "./ChatTypingIndicator";
import { ContextPicker, type ContextPickerRef } from "./ContextPicker";

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
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextPickerRef = useRef<ContextPickerRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState(0);

  const cliStatus = activeCLIProvider ? cliStatuses[activeCLIProvider] : null;
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-slot='scroll-area-viewport']");
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isLoading, status]);

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

  return (
    <div className="flex h-full flex-col">
      {/* Session Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/40 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ChatTeardropText size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            {activeSession?.title ?? "Chat"}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">
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
      <div className="flex-1 min-h-0">
        <ScrollArea ref={scrollRef} className="h-full">
          <div className="flex flex-col gap-4 p-4">
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

            {messages.map((msg: UIMessage, index: number) => {
              const text = msg.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");
              const isStreaming =
                status === "streaming" && index === messages.length - 1 && msg.role === "assistant";
              return (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={text}
                  isStreaming={isStreaming}
                />
              );
            })}

            {status === "submitted" && (
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Robot size={14} className="text-muted-foreground" />
                </div>
                <div className="rounded-xl bg-muted px-3.5 py-2.5">
                  <ChatTypingIndicator />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-border/60 p-3">
        {/* Error Banner */}
        {error && (
          <div className="mb-2 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
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
          <div className="mb-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-[12px] text-primary">
            <Terminal size={14} />
            <span>
              Using {cliStatus.provider_id} via CLI
              {cliStatus.user && ` — ${cliStatus.user}`}
            </span>
          </div>
        )}

        {!canChat && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-[12px] text-amber-500">
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
              className="min-h-[36px] resize-none py-2 text-[13px]"
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
