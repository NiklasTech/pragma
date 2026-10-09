import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { WorkspaceSettings } from "./types";

export type WorkspaceTrust = "none" | "pending" | "trusted" | "rejected";

interface TrustDecision {
  key: string;
  trusted: boolean;
}

interface WorkspaceTrustState {
  decisions: Record<string, TrustDecision>;
  decide: (rootPath: string, key: string, trusted: boolean) => void;
}

/// The values of a workspace file that change what the agent may do without asking.
export function securityKey(settings: WorkspaceSettings | null): string | null {
  const commands = settings?.agent?.allowedCommands ?? [];
  return commands.length > 0 ? JSON.stringify(commands) : null;
}

/// One decision per workspace; a changed file asks again.
export const useWorkspaceTrustStore = create<WorkspaceTrustState>()(
  persist(
    (set) => ({
      decisions: {},
      decide: (rootPath, key, trusted) =>
        set((state) => ({ decisions: { ...state.decisions, [rootPath]: { key, trusted } } })),
    }),
    { name: "pragma.workspace-trust.v1" },
  ),
);

export function resolveTrust(
  rootPath: string | null,
  settings: WorkspaceSettings | null,
  decisions: Record<string, TrustDecision>,
): WorkspaceTrust {
  const key = securityKey(settings);
  if (!rootPath || key === null) return "none";
  const decision = decisions[rootPath];
  if (!decision || decision.key !== key) return "pending";
  return decision.trusted ? "trusted" : "rejected";
}
