"use client";

import { useAIStore } from "@/shared/stores/ai";

export function ChatPanelHeader() {
  const title = useAIStore((state) => {
    const session = state.chatSessions.find((item) => item.id === state.activeChatSessionId);
    return session && session.title !== "New Chat" ? session.title : null;
  });

  return (
    <div className="flex h-8 shrink-0 items-center px-3">
      <span
        className="truncate text-ui-xs font-semibold text-fg-default"
        title={title ?? undefined}
      >
        {title ?? "New thread"}
      </span>
    </div>
  );
}
