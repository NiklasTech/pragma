import { useEffect } from "react";

import { useAgentStore } from "@/features/agent/store";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useUiModeStore } from "@/shell/mode";

import { useSpawnApprovalsStore } from "../children/acpSpawn";
import { useChildRunsStore } from "../children/runStore";
import { childRunOutcomes, type AttentionKind } from "../notifications/activity";
import { subscribeSessionOutcomes } from "../notifications/outcomes";
import { readSessionActivity } from "../notifications/useSessionActivity";
import { selectFocusedSessionId, useAgentsPanesStore } from "../panes/store";
import { useSessionRunsStore } from "../tasks/sessionRuns";
import { ACTIVITY_HOLD_MS, isAgentOutput } from "../terminal/activity";
import {
  getTerminalEntryStatus,
  getTerminalLastInputAt,
  subscribeAnyTerminalOutput,
  subscribeAnyTerminalStatus,
} from "../terminal/runner";
import { trackStates } from "./dashboard";
import { clearOutcome, setOutcome, setTerminalWorking, useActivityStore } from "./store";

function lookedAtSessionId(): string | null {
  if (useUiModeStore.getState().uiMode !== "agents") return null;
  const rootPath = useFileExplorerStore.getState().rootPath ?? "default";
  return selectFocusedSessionId(useAgentsPanesStore.getState(), rootPath);
}

/// Keeps each session's dashboard state and when it entered it, from store and terminal events.
export function useActivityTracker(): void {
  useEffect(() => {
    const holdTimers = new Map<string, ReturnType<typeof setTimeout>>();
    let lookedAt = lookedAtSessionId();

    const refresh = () => {
      const activity = readSessionActivity();
      for (const sessionId of [...activity.running, ...activity.waiting]) clearOutcome(sessionId);
      const { entries, outcomes, terminalWorking } = useActivityStore.getState();
      const sessions = useAIStore.getState().chatSessions.filter((session) => !session.archived);
      const next = trackStates(
        entries,
        sessions,
        {
          running: new Set(activity.running),
          waiting: new Set(activity.waiting),
          terminalWorking: new Set(Object.keys(terminalWorking)),
          outcomes,
        },
        Date.now(),
      );
      if (next !== entries) useActivityStore.setState({ entries: next });
    };

    const recordOutcome = (sessionId: string, kind: AttentionKind) => {
      if (kind === "approval" || sessionId === lookedAtSessionId()) return;
      if (setOutcome(sessionId, kind)) refresh();
    };

    const refreshLookedAt = () => {
      const next = lookedAtSessionId();
      if (next === lookedAt) return;
      lookedAt = next;
      if (next && clearOutcome(next)) refresh();
    };

    const stopTerminalWork = (sessionId: string) => {
      clearTimeout(holdTimers.get(sessionId));
      holdTimers.delete(sessionId);
      if (setTerminalWorking(sessionId, false)) refresh();
    };

    const unsubscribes = [
      useAgentStore.subscribe(refresh),
      useSessionRunsStore.subscribe(refresh),
      useSpawnApprovalsStore.subscribe(refresh),
      useChildRunsStore.subscribe((state, previous) => {
        for (const outcome of childRunOutcomes(previous.runs, state.runs)) {
          recordOutcome(outcome.sessionId, outcome.kind);
        }
        refresh();
      }),
      useAIStore.subscribe((state, previous) => {
        if (state.chatSessions !== previous.chatSessions) refresh();
      }),
      useAgentsPanesStore.subscribe(refreshLookedAt),
      useUiModeStore.subscribe(refreshLookedAt),
      useFileExplorerStore.subscribe((state, previous) => {
        if (state.rootPath !== previous.rootPath) refreshLookedAt();
      }),
      subscribeSessionOutcomes(recordOutcome),
      subscribeAnyTerminalOutput((sessionId) => {
        if (!isAgentOutput(Date.now(), getTerminalLastInputAt(sessionId))) return;
        clearTimeout(holdTimers.get(sessionId));
        holdTimers.set(
          sessionId,
          setTimeout(() => stopTerminalWork(sessionId), ACTIVITY_HOLD_MS),
        );
        if (setTerminalWorking(sessionId, true)) refresh();
      }),
      subscribeAnyTerminalStatus((sessionId) => {
        if (getTerminalEntryStatus(sessionId) !== "running") stopTerminalWork(sessionId);
      }),
    ];
    refresh();

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
      for (const timer of holdTimers.values()) clearTimeout(timer);
    };
  }, []);
}
