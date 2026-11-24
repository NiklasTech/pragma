import { useEffect } from "react";

import { useAgentStore } from "@/features/agent/store";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useUiModeStore } from "@/shell/mode";

import { useAcpApprovalsStore } from "../acp/acpApprovals";
import { useSpawnApprovalsStore } from "../children/acpSpawn";
import { useChildRunsStore } from "../children/runStore";
import { useBackgroundChatsStore } from "../live/backgroundChats";
import { childRunOutcomes, type AttentionKind } from "../notifications/activity";
import { subscribeSessionOutcomes } from "../notifications/outcomes";
import { readSessionInView } from "../notifications/sessionInView";
import { readSessionActivity } from "../notifications/useSessionActivity";
import { paneTreeKey, selectFocusedSessionId, useAgentsPanesStore } from "../panes/store";
import { useSessionRunsStore } from "../tasks/sessionRuns";
import { ACTIVITY_HOLD_MS, isAgentOutput } from "../terminal/activity";
import {
  getTerminalLastInputAt,
  getTerminalStatus,
  subscribeAnyTerminalOutput,
  subscribeAnyTerminalStatus,
  subscribeTerminalAttention,
  type TerminalAttentionKind,
} from "../terminal/runner";
import { isShellSession } from "../terminal/shell";
import { useAgentStatesStore, type AgentStateEvent } from "./agentStates";

const OUTCOME_EVENTS: Record<AttentionKind | TerminalAttentionKind, AgentStateEvent> = {
  finished: "done",
  failed: "needs-you",
  approval: "needs-you",
  input: "needs-you",
};

function isCliTerminal(sessionId: string): boolean {
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  return session?.kind === "terminal" && !isShellSession(session);
}

/** Feeds every source of agent state into the one store, and marks what the user looks at. */
export function useAgentStateFeed(): void {
  useEffect(() => {
    const store = useAgentStatesStore.getState;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let live = new Set<string>();

    const markSeen = (sessionId: string) => {
      if (document.hasFocus() && readSessionInView(sessionId)) store().apply(sessionId, "seen");
    };
    const apply = (sessionId: string, event: AgentStateEvent) => {
      // A terminal can still report after its session was deleted; such a state would never clear.
      const known = useAIStore.getState().chatSessions.some((session) => session.id === sessionId);
      if (!known) return;
      store().apply(sessionId, event);
      if (event === "done") markSeen(sessionId);
    };

    const refreshRuns = () => {
      const activity = readSessionActivity();
      const next = new Set([...activity.waiting, ...activity.running]);
      for (const id of activity.waiting) apply(id, "needs-you");
      for (const id of activity.running) if (!activity.waiting.includes(id)) apply(id, "working");
      for (const id of live) if (!next.has(id)) apply(id, "idle");
      live = next;
    };

    const seenFocused = () => {
      const rootPath = useFileExplorerStore.getState().rootPath ?? "default";
      const sessionId = selectFocusedSessionId(
        useAgentsPanesStore.getState(),
        paneTreeKey(rootPath),
      );
      if (sessionId) markSeen(sessionId);
    };

    const onTerminalOutput = (sessionId: string) => {
      if (!isCliTerminal(sessionId)) return;
      const lastInputAt = getTerminalLastInputAt(sessionId);
      // A question stays open, and a finished run stays done, until the user typed after it.
      const entry = store().entries[sessionId];
      const asked = entry?.state === "needs-you";
      const settled = asked || entry?.state === "done";
      if (settled && lastInputAt < entry.changedAt) return;
      // A rejected request ends the turn at once, so its output arrives within the echo window.
      if (!asked && !isAgentOutput(Date.now(), lastInputAt)) return;
      apply(sessionId, "working");
      const previous = timers.get(sessionId);
      if (previous) clearTimeout(previous);
      timers.set(
        sessionId,
        setTimeout(() => {
          timers.delete(sessionId);
          if (store().entries[sessionId]?.state === "working") apply(sessionId, "idle");
        }, ACTIVITY_HOLD_MS),
      );
    };

    const onTerminalStatus = (sessionId: string) => {
      const { status, exitCode } = getTerminalStatus(sessionId);
      if (!isCliTerminal(sessionId) || status === "running") return;
      // A clean or cancelled exit ends the run and any open question; a failed one needs a look.
      const failed = status === "exited" && exitCode !== 0;
      if (failed && store().entries[sessionId]?.state === "needs-you") return;
      apply(sessionId, "idle");
    };

    let previousRoot = useFileExplorerStore.getState().rootPath;
    let previousIds = new Set(useAIStore.getState().chatSessions.map((session) => session.id));
    const forgetDeleted = () => {
      const rootPath = useFileExplorerStore.getState().rootPath;
      const ids = new Set(useAIStore.getState().chatSessions.map((session) => session.id));
      // Switching folders reloads the list; only a removal within one folder is a deletion.
      if (rootPath === previousRoot) {
        for (const id of previousIds) if (!ids.has(id)) store().forget(id);
      }
      previousRoot = rootPath;
      previousIds = ids;
    };

    const onWindowFocus = () => seenFocused();
    window.addEventListener("focus", onWindowFocus);

    const unsubscribes = [
      useAgentStore.subscribe(refreshRuns),
      useSessionRunsStore.subscribe(refreshRuns),
      useBackgroundChatsStore.subscribe(refreshRuns),
      useSpawnApprovalsStore.subscribe(refreshRuns),
      useAcpApprovalsStore.subscribe(refreshRuns),
      useChildRunsStore.subscribe((state, previous) => {
        for (const outcome of childRunOutcomes(previous.runs, state.runs)) {
          apply(outcome.sessionId, OUTCOME_EVENTS[outcome.kind]);
        }
        refreshRuns();
      }),
      subscribeSessionOutcomes((sessionId, kind) => apply(sessionId, OUTCOME_EVENTS[kind])),
      subscribeTerminalAttention((sessionId, kind) => apply(sessionId, OUTCOME_EVENTS[kind])),
      subscribeAnyTerminalOutput(onTerminalOutput),
      subscribeAnyTerminalStatus(onTerminalStatus),
      useAgentsPanesStore.subscribe(seenFocused),
      useUiModeStore.subscribe(seenFocused),
      useOpenRepositoriesStore.subscribe(seenFocused),
      useAIStore.subscribe(forgetDeleted),
    ];
    refreshRuns();

    return () => {
      window.removeEventListener("focus", onWindowFocus);
      for (const unsubscribe of unsubscribes) unsubscribe();
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);
}
