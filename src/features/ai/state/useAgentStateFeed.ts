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
import { matchCliManifest } from "../terminal/foregroundCli";
import { useForegroundStore, watchForeground } from "../terminal/foregroundPoller";
import { isShellSession } from "../terminal/shell";
import { liveSessionIds, useAgentStatesStore, type AgentStateEvent } from "./agentStates";

const OUTCOME_EVENTS: Record<AttentionKind | TerminalAttentionKind, AgentStateEvent> = {
  finished: "done",
  failed: "needs-you",
  approval: "needs-you",
  input: "needs-you",
};

/** Whether a coding CLI runs in the shell right now, such as `claude` typed into it. */
function shellRunsCli(sessionId: string): boolean {
  const names = useForegroundStore.getState().names[sessionId];
  return names ? matchCliManifest(names, useAIStore.getState().cliManifests) !== null : false;
}

/** A terminal whose output and signals come from an agent; a plain shell's bell does not count. */
function isAgentTerminal(sessionId: string): boolean {
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  if (session?.kind !== "terminal") return false;
  return !isShellSession(session) || shellRunsCli(sessionId);
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
      // A session can still report after it was deleted or archived; such a state would never clear.
      const known = liveSessionIds(useAIStore.getState().chatSessions).has(sessionId);
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
      if (!isAgentTerminal(sessionId)) return;
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
      if (!(sessionId in store().entries) || status === "running") return;
      // A clean or cancelled exit ends the run and any open question; a failed one needs a look.
      const failed = status === "exited" && exitCode !== 0;
      if (failed && store().entries[sessionId]?.state === "needs-you") return;
      apply(sessionId, "idle");
    };

    const forgetGone = () => {
      const ids = liveSessionIds(useAIStore.getState().chatSessions);
      for (const id of Object.keys(store().entries)) if (!ids.has(id)) store().forget(id);
    };

    const shellWatches = new Map<string, () => void>();
    // Every shell is watched, so a CLI in a shell of another space counts as well.
    const watchShells = () => {
      const shells = new Set(
        useAIStore
          .getState()
          .chatSessions.filter((session) => isShellSession(session) && !session.archived)
          .map((session) => session.id),
      );
      for (const id of shells) {
        if (!shellWatches.has(id)) shellWatches.set(id, watchForeground(id));
      }
      for (const [id, stop] of shellWatches) {
        if (shells.has(id)) continue;
        stop();
        shellWatches.delete(id);
      }
    };

    // The CLI in a shell ended, so nothing in there waits or works anymore.
    const forgetEndedShellClis = () => {
      const sessions = useAIStore.getState().chatSessions;
      for (const id of Object.keys(store().entries)) {
        const session = sessions.find((item) => item.id === id);
        if (session && isShellSession(session) && !shellRunsCli(id)) store().forget(id);
      }
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
      subscribeTerminalAttention((sessionId, kind) => {
        if (isAgentTerminal(sessionId)) apply(sessionId, OUTCOME_EVENTS[kind]);
      }),
      useForegroundStore.subscribe(forgetEndedShellClis),
      subscribeAnyTerminalOutput(onTerminalOutput),
      subscribeAnyTerminalStatus(onTerminalStatus),
      useAgentsPanesStore.subscribe(seenFocused),
      useUiModeStore.subscribe(seenFocused),
      useOpenRepositoriesStore.subscribe(seenFocused),
      useAIStore.subscribe((state, previous) => {
        if (state.chatSessions === previous.chatSessions) return;
        forgetGone();
        watchShells();
      }),
    ];
    refreshRuns();
    watchShells();

    return () => {
      for (const stop of shellWatches.values()) stop();
      window.removeEventListener("focus", onWindowFocus);
      for (const unsubscribe of unsubscribes) unsubscribe();
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, []);
}
