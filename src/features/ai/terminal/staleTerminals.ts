import type { ChatSession } from "@/shared/stores/ai";

type TerminalCandidate = Pick<ChatSession, "id" | "kind" | "parentId">;

/// A CLI terminal cannot be resumed, so a standalone one only matters while open or running.
export function isStaleTerminal(
  session: TerminalCandidate,
  openSessionIds: ReadonlySet<string>,
  isRunning: (sessionId: string) => boolean,
): boolean {
  if (session.kind !== "terminal" || session.parentId) return false;
  return !openSessionIds.has(session.id) && !isRunning(session.id);
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
