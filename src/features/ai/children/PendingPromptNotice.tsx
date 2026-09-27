import { HourglassMedium } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { useAgentStore } from "@/features/agent/store";
import type { ChatSession } from "@/shared/stores/ai";

import { isPromptBlocked, usePendingPromptStore } from "./pendingPrompt";

export function PendingPromptNotice({ session }: { session: ChatSession | undefined }) {
  const agentStatus = useAgentStore((state) => state.status);
  const runSessionId = useAgentStore((state) => state.runSessionId);
  const forcedSessionId = usePendingPromptStore((state) => state.forcedSessionId);
  const forceStart = usePendingPromptStore((state) => state.forceStart);

  if (!session?.pendingPrompt || forcedSessionId === session.id) return null;
  if (!isPromptBlocked(session.id, agentStatus, runSessionId)) return null;

  return (
    <div className="mb-2 flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-surface px-3 py-2 text-ui-xs text-fg-muted">
      <HourglassMedium size={14} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        This session starts when the running session finishes its turn.
      </span>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full px-3"
        onClick={() => forceStart(session.id)}
      >
        Start now
      </Button>
    </div>
  );
}
