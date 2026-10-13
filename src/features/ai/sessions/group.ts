import type { ChatSession } from "@/shared/stores/ai";

import type { StartSessionRequest } from "./start";

/** How sessions started together relate: own worktrees, one joint worktree, or the checkout. */
export type GroupEnvironment = "isolated" | "shared" | "checkout";

export const DEFAULT_GROUP_ENVIRONMENT = "isolated" satisfies GroupEnvironment;

export const GROUP_ENVIRONMENT_LABELS: Record<GroupEnvironment, string> = {
  isolated: "Each in its own worktree",
  shared: "One shared worktree",
  checkout: "This checkout",
};

/** The environment part of the next request; `first` is the group's first started session. */
export function groupEnvironmentRequest(
  mode: GroupEnvironment,
  first: Pick<ChatSession, "environment" | "environmentId"> | undefined,
): Pick<StartSessionRequest, "environment" | "sameEnvironmentAs"> {
  if (mode === "checkout") return { environment: "checkout" };
  if (mode === "shared" && first) return { sameEnvironmentAs: first };
  return { environment: "worktree" };
}

/** Whether several writing sessions of the group would edit the same files. */
export function sharesFiles(mode: GroupEnvironment, count: number): boolean {
  return mode !== "isolated" && count > 1;
}
