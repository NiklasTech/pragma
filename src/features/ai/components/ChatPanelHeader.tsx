"use client";

import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";

export function ChatPanelHeader() {
  const title = useAIStore((state) => {
    const session = state.chatSessions.find((item) => item.id === state.activeChatSessionId);
    return session && session.title !== "New Chat" ? session.title : null;
  });

  return (
    <div className="flex h-8 shrink-0 items-center px-3">
      <span
        className={cn(
          "min-w-0 truncate text-ui-sm",
          title ? "font-semibold text-fg-default" : "font-medium text-fg-muted",
        )}
        title={title ?? undefined}
      >
        {title ?? "New thread"}
      </span>
    </div>
  );
}
