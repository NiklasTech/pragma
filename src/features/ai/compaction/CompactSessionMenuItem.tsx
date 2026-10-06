"use client";

import { ArrowsInLineVertical } from "@phosphor-icons/react";

import { DropdownMenuItem } from "@/shared/components/ui/dropdown-menu";
import { pinnedSessionEngine, resolveEffectiveEngine } from "@/shared/lib/ai/sessionEngine";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { compactSession, useCompactionStore } from "./compactSession";

/// Session menu entry for chats on a built-in provider; coding agents manage their own context.
export function CompactSessionMenuItem({ session }: { session: ChatSession }) {
  const running = useCompactionStore((state) => state.running[session.id] === true);
  const builtin = useAIStore(
    (state) => resolveEffectiveEngine(pinnedSessionEngine(session), state).cliProviderId === null,
  );
  if (session.kind === "terminal" || session.parentId || !builtin) return null;

  return (
    <DropdownMenuItem
      disabled={running || session.messages.length === 0}
      onClick={() => void compactSession(session.id, "manual")}
    >
      <ArrowsInLineVertical size={13} />
      <span>{running ? "Compacting..." : "Compact"}</span>
    </DropdownMenuItem>
  );
}
