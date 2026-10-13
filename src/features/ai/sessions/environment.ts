import type { ChatSession } from "@/shared/stores/ai";

import { isWritingSession } from "../children/limits";

export type EnvironmentChoice = "checkout" | "worktree";

export interface EnvironmentContext {
  kind: ChatSession["kind"];
  /** An explicit choice of the caller, such as a menu item the user picked. */
  override?: EnvironmentChoice;
  /** The project setting "Writing sessions work in". */
  setting?: EnvironmentChoice;
  isRepo: boolean;
  sessions: readonly ChatSession[];
}

function isCheckoutOccupied(sessions: readonly ChatSession[]): boolean {
  return sessions.some(
    (session) =>
      session.kind !== undefined && isWritingSession(session) && session.environment !== "worktree",
  );
}

/** The environment a writing session gets without an explicit choice. */
export function defaultEnvironment(
  sessions: readonly ChatSession[],
  setting: EnvironmentChoice | undefined,
): EnvironmentChoice {
  if (setting) return setting;
  return isCheckoutOccupied(sessions) ? "worktree" : "checkout";
}

export function resolveEnvironment(context: EnvironmentContext): EnvironmentChoice {
  if (!isWritingSession({ kind: context.kind }) || !context.isRepo) return "checkout";
  return context.override ?? defaultEnvironment(context.sessions, context.setting);
}
