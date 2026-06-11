import { useRef, useEffect, useCallback } from "react";
import { PaperPlaneRight, Warning, Terminal, Plus, ChatTeardropText } from "@phosphor-icons/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAI } from "@/hooks/useAI";
import { useAIStore } from "@/stores/ai";
import { ChatMessage } from "./ChatMessage";
import { ChatSessionList } from "./ChatSessionList";
import type { UIMessage } from "@ai-sdk/react";

export function ChatPanel() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    canChat,
    isCLIActive,
    activeCLIProvider,
    sessionId,
    createChatSession,
  } = useAI();
  const { cliStatuses, activeChatSessionId, chatSessions } = useAIStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const cliStatus = activeCLIProvider ? cliStatuses[activeCLIProvider] : null;
  const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector("[data-slot='scroll-area-viewport']");
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isLoading]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (input.trim() && !isLoading) {
          handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
        }
      }
    },
    [input, isLoading, handleSubmit],
  );

  const handleNewSession = useCallback(() => {
    createChatSession();
  }, [createChatSession]);

  return (
    <div className="flex h-full flex-col">
      {/* Session Header */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <ChatTeardropText size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground truncate">
            {activeSession?.title ?? "Chat"}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">
            {sessionId.slice(0, 12)}
          </span>
        </div>
        <div className="flex items-center gap-1">
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

            {messages.map((msg: UIMessage) => {
              const text = msg.parts
                .filter((p) => p.type === "text")
                .map((p) => (p as { text: string }).text)
                .join("");
              return <ChatMessage key={msg.id} role={msg.role} content={text} />;
            })}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                </div>
                <div className="rounded-xl bg-muted px-3.5 py-2.5">
                  <span className="text-[13px] text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-border/60 p-3">
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
          <Textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder={canChat ? "Ask anything..." : "Configure a provider first..."}
            rows={1}
            className="min-h-[36px] resize-none py-2 text-[13px]"
            disabled={!canChat || isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || !canChat}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 disabled:hover:bg-primary"
          >
            <PaperPlaneRight size={16} weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
}
