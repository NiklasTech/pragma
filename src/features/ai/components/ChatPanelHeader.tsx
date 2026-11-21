"use client";

import { X } from "@phosphor-icons/react";

import { IconButton } from "@/shared/components/ui/icon-button";
import { formatShortcut, getIsMac } from "@/shared/lib/shortcuts";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useLayoutStore } from "@/shell/layout";
import { useSettingsStore } from "@/shared/stores/settings";

export function ChatPanelHeader() {
  const title = useAIStore((state) => {
    const session = state.chatSessions.find((item) => item.id === state.activeChatSessionId);
    return session && session.title !== "New Chat" ? session.title : null;
  });
  const toggleShortcut = useSettingsStore((state) => state.shortcuts["ai.toggle"]);

  return (
    <div className="flex h-tab shrink-0 items-center gap-2 border-b border-border-subtle pr-1.5 pl-3.5">
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-ui-sm",
          title ? "font-semibold text-fg-default" : "font-medium text-fg-muted",
        )}
        title={title ?? undefined}
      >
        {title ?? "New thread"}
      </span>
      <IconButton
        icon={X}
        size="sm"
        label="Close chat"
        shortcut={formatShortcut(toggleShortcut, getIsMac())}
        onClick={() => useLayoutStore.getState().toggleAI()}
      />
    </div>
  );
}
