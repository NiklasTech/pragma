import type { ChatSession } from "@/shared/stores/ai";

export type WorktreeChoice = "checkout" | "worktree";

function isCheckoutOccupied(sessions: ChatSession[]): boolean {
  return sessions.some((session) => session.kind === "agent" && session.environment !== "worktree");
}

export function defaultEnvironment(
  sessions: ChatSession[],
  remembered: WorktreeChoice | null | undefined,
): WorktreeChoice {
  if (isCheckoutOccupied(sessions)) return "worktree";
  return remembered === "worktree" ? "worktree" : "checkout";
}
