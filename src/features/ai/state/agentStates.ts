import { create } from "zustand";

import type { AgentState } from "@/shared/components/ui/status-dot";

/** What happened to an agent session; the store turns these into one of the four states. */
export type AgentStateEvent = "working" | "needs-you" | "done" | "idle" | "seen";

export interface AgentStateEntry {
  state: AgentState;
  /** False while a "done" was not looked at yet; such a done stays until it is seen. */
  seen: boolean;
  changedAt: number;
}

const IDLE: AgentStateEntry = { state: "idle", seen: true, changedAt: 0 };

/** The next state of a session after an event; pure, so every transition is tested. */
export function nextAgentState(
  previous: AgentStateEntry | undefined,
  event: AgentStateEvent,
  now: number,
): AgentStateEntry {
  const current = previous ?? IDLE;
  const to = (state: AgentState, seen: boolean): AgentStateEntry =>
    current.state === state && current.seen === seen ? current : { state, seen, changedAt: now };

  switch (event) {
    case "working":
      return to("working", true);
    case "needs-you":
      return to("needs-you", false);
    case "done":
      return to("done", false);
    case "idle":
      // A finished run that nobody has looked at yet keeps showing as done.
      return current.state === "done" && !current.seen ? current : to("idle", true);
    case "seen":
      // Looking clears a done; a question still waits for an answer.
      if (current.state === "done") return to("idle", true);
      return current.seen ? current : { ...current, seen: true };
  }
}

const PRIORITY: Record<AgentState, number> = { "needs-you": 0, done: 1, working: 2, idle: 3 };

/** Sorts states from most to least urgent: needs you, done, working, idle. */
export function compareAgentStates(a: AgentState, b: AgentState): number {
  return PRIORITY[a] - PRIORITY[b];
}

export interface AgentStateSummary {
  needsYou: string[];
  done: string[];
  working: string[];
  /** The session to show first: the oldest that needs you, else the newest done or working. */
  first: string | null;
}

export function summarizeAgentStates(entries: Record<string, AgentStateEntry>): AgentStateSummary {
  const pick = (state: AgentState) =>
    Object.entries(entries)
      .filter(([, entry]) => entry.state === state)
      .sort(([, a], [, b]) =>
        state === "needs-you" ? a.changedAt - b.changedAt : b.changedAt - a.changedAt,
      )
      .map(([id]) => id);
  const needsYou = pick("needs-you");
  const done = pick("done");
  const working = pick("working");
  return { needsYou, done, working, first: needsYou[0] ?? done[0] ?? working[0] ?? null };
}

interface AgentStatesState {
  entries: Record<string, AgentStateEntry>;
  apply: (sessionId: string, event: AgentStateEvent) => void;
  forget: (sessionId: string) => void;
}

/** One state per agent session, from the built-in agent, ACP runs and CLI terminals alike. */
export const useAgentStatesStore = create<AgentStatesState>()((set) => ({
  entries: {},
  apply: (sessionId, event) =>
    set((store) => {
      const previous = store.entries[sessionId];
      const next = nextAgentState(previous, event, Date.now());
      if (next === previous || (!previous && next.state === "idle")) return {};
      return { entries: { ...store.entries, [sessionId]: next } };
    }),
  forget: (sessionId) =>
    set((store) => {
      if (!(sessionId in store.entries)) return {};
      const { [sessionId]: _removed, ...entries } = store.entries;
      return { entries };
    }),
}));

export function selectAgentState(sessionId: string | null | undefined) {
  return (store: AgentStatesState): AgentState =>
    (sessionId ? store.entries[sessionId]?.state : undefined) ?? "idle";
}
