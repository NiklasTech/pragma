import { useMemo } from "react";

import { focusAttentionSession } from "@/features/ai/notifications/focusSession";
import { sessionAgentManifest } from "@/features/ai/sessions/sessionAgent";
import { summarizeAgentStates, useAgentStatesStore } from "@/features/ai/state/agentStates";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { StatusDot, type AgentState } from "@/shared/components/ui/status-dot";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";

const MAX_MARKS = 4;

interface PillMark {
  sessionId: string;
  agentId: string | undefined;
  name: string;
  state: AgentState;
}

function useMarks(sessionIds: Array<[string, AgentState]>): PillMark[] {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const cliManifests = useAIStore((state) => state.cliManifests);
  const activeCLIProvider = useAIStore((state) => state.activeCLIProvider);
  return useMemo(() => {
    const ai = useAIStore.getState();
    return sessionIds.slice(0, MAX_MARKS).map(([sessionId, state]) => {
      const manifest = sessionAgentManifest(ai, sessionId);
      return { sessionId, agentId: manifest?.id, name: manifest?.name ?? "Pragma", state };
    });
    // The store fields are listed so the marks follow sessions, manifests and the default CLI.
  }, [sessionIds, chatSessions, cliManifests, activeCLIProvider]);
}

/// How the agents are doing at a glance; a click shows the session that needs you first.
export function StatusPill() {
  const entries = useAgentStatesStore((store) => store.entries);
  const summary = useMemo(() => summarizeAgentStates(entries), [entries]);
  const { needsYou, working, done, first } = summary;
  const ordered = useMemo(
    (): Array<[string, AgentState]> => [
      ...summary.needsYou.map((id): [string, AgentState] => [id, "needs-you"]),
      ...summary.working.map((id): [string, AgentState] => [id, "working"]),
      ...summary.done.map((id): [string, AgentState] => [id, "done"]),
    ],
    [summary],
  );
  const marks = useMarks(ordered);
  const target = first;

  const parts = [
    needsYou.length > 0 && `${needsYou.length} ${needsYou.length === 1 ? "needs" : "need"} you`,
    working.length > 0 && `${working.length} working`,
    needsYou.length === 0 && done.length > 0 && `${done.length} done`,
  ].filter((part): part is string => Boolean(part));

  return (
    <Button
      variant="ghost"
      disabled={!target}
      onClick={() => target && focusAttentionSession(target)}
      title={target ? "Show the session that needs you first" : "No agent is running"}
      className={cn(
        "rounded-full bg-bg-well pr-3 text-ui-xs font-normal ring-1 ring-border ring-inset hover:bg-bg-well hover:ring-fg-subtle disabled:pointer-events-auto disabled:cursor-default disabled:opacity-100 disabled:hover:ring-border",
        marks.length > 0 ? "gap-2.5 pl-1.75" : "pl-2.5",
      )}
    >
      {marks.length > 0 ? (
        <span className="flex items-center gap-1" aria-hidden="true">
          {marks.map((mark) => (
            <AgentMark
              key={mark.sessionId}
              agentId={mark.agentId}
              name={mark.name}
              state={mark.state}
              size="sm"
              className="animate-in duration-200 zoom-in-75 fade-in-0 motion-reduce:animate-none"
            />
          ))}
        </span>
      ) : (
        <StatusDot state="idle" decorative />
      )}
      <span className="flex items-center gap-1.5">
        {parts.length > 0 ? (
          parts.map((part, index) => (
            <span
              key={part}
              className={cn(
                index === 0 && needsYou.length > 0 && "font-medium text-state-needs-you",
                index > 0 && "text-fg-subtle",
              )}
            >
              {index > 0 && "· "}
              {part}
            </span>
          ))
        ) : (
          <span>All quiet</span>
        )}
      </span>
    </Button>
  );
}
