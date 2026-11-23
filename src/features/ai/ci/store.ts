import { create } from "zustand";

import type { CiStatus } from "./status";

/** The pull request of an agent worktree and the state of its checks. */
export interface AgentCi {
  number: number;
  url: string;
  status: CiStatus | null;
}

export type CiEventKind = "fail" | "pass" | "run" | "sent";

/** One line of an environment's CI history. */
export interface CiEvent {
  at: number;
  kind: CiEventKind;
  text: string;
}

/** Fixes Pragma handed to the agent on its own for one pull request. */
export interface CiFixes {
  number: number;
  count: number;
  /** You stopped the fixes; the next failure asks you. */
  stopped?: boolean;
}

const MAX_EVENTS = 8;

interface AgentCiState {
  byEnvironment: Record<string, AgentCi>;
  /** The failure each environment's card was answered for, sent or ignored. */
  handled: Record<string, string>;
  /** The failure each environment's card asks you about. */
  asking: Record<string, string>;
  fixes: Record<string, CiFixes>;
  history: Record<string, CiEvent[]>;
}

export const useAgentCiStore = create<AgentCiState>()(() => ({
  byEnvironment: {},
  handled: {},
  asking: {},
  fixes: {},
  history: {},
}));

export function markFailureHandled(environmentId: string, failureKey: string): void {
  useAgentCiStore.setState((state) => ({
    handled: { ...state.handled, [environmentId]: failureKey },
  }));
}

export function markFailureAsking(environmentId: string, failureKey: string): void {
  useAgentCiStore.setState((state) => ({
    asking: { ...state.asking, [environmentId]: failureKey },
  }));
}

/** Fixes already sent for the pull request; a new pull request starts from none. */
export function fixesUsed(environmentId: string, number: number): number {
  const fixes = useAgentCiStore.getState().fixes[environmentId];
  if (fixes?.number !== number) return 0;
  return fixes.stopped ? Number.POSITIVE_INFINITY : fixes.count;
}

export function setFixes(environmentId: string, fixes: CiFixes | null): void {
  useAgentCiStore.setState((state) => {
    const next = { ...state.fixes };
    if (fixes) next[environmentId] = fixes;
    else delete next[environmentId];
    return { fixes: next };
  });
}

export function recordCiEvent(environmentId: string, kind: CiEventKind, text: string): void {
  useAgentCiStore.setState((state) => {
    const events = [...(state.history[environmentId] ?? []), { at: Date.now(), kind, text }];
    return { history: { ...state.history, [environmentId]: events.slice(-MAX_EVENTS) } };
  });
}

export function setAgentCi(environmentId: string, ci: AgentCi): void {
  useAgentCiStore.setState((state) => ({
    byEnvironment: { ...state.byEnvironment, [environmentId]: ci },
  }));
}

/** Forgets the environments of `environmentIds` that `keep` does not name. */
export function pruneAgentCi(environmentIds: readonly string[], keep: ReadonlySet<string>): void {
  const stale = environmentIds.filter((id) => !keep.has(id));
  if (stale.length === 0) return;
  useAgentCiStore.setState((state) => {
    const byEnvironment = { ...state.byEnvironment };
    for (const id of stale) delete byEnvironment[id];
    return { byEnvironment };
  });
}
