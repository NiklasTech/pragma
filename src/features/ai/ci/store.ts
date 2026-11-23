import { create } from "zustand";

import type { CiStatus } from "./status";

/** The pull request of an agent worktree and the state of its checks. */
export interface AgentCi {
  number: number;
  url: string;
  status: CiStatus | null;
}

interface AgentCiState {
  byEnvironment: Record<string, AgentCi>;
}

export const useAgentCiStore = create<AgentCiState>()(() => ({ byEnvironment: {} }));

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
