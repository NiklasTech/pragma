import type { ChatSession } from "@/shared/stores/ai";

import { resumableCliSession } from "./resume";

type TerminalCandidate = Pick<
  ChatSession,
  "id" | "kind" | "parentId" | "cliProviderId" | "cliSessionId" | "environment"
> &
  Partial<Pick<ChatSession, "updatedAt">>;

/** How long a conversation that no pane shows stays in the thread list. */
const KEEP_MS = 14 * 24 * 60 * 60 * 1000;

/// A conversation the CLI can resume stays for a while. One in a worktree does not, because the
/// worktree goes once no session needs it, and the CLI resumes only in the folder it ran in.
export function isKeptForResume(session: TerminalCandidate, now: number): boolean {
  return (
    resumableCliSession(session) !== null &&
    session.environment !== "worktree" &&
    now - (session.updatedAt ?? 0) < KEEP_MS
  );
}

/// A standalone terminal that cannot be resumed only matters while open or running.
export function isStaleTerminal(
  session: TerminalCandidate,
  openSessionIds: ReadonlySet<string>,
  isRunning: (sessionId: string) => boolean,
  now = Date.now(),
): boolean {
  if (session.kind !== "terminal" || session.parentId) return false;
  if (openSessionIds.has(session.id) || isRunning(session.id)) return false;
  return !isKeptForResume(session, now);
}

export function staleTerminalIds(
  sessions: TerminalCandidate[],
  openSessionIds: ReadonlySet<string>,
  isRunning: (sessionId: string) => boolean,
): string[] {
  return sessions
    .filter((session) => isStaleTerminal(session, openSessionIds, isRunning))
    .map((session) => session.id);
}
