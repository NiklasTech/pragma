import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";

export interface JoinableWorktree {
  environment: WorkEnvironment;
  /** Sessions that work in it, most recently updated first. */
  sessions: ChatSession[];
}

function isListed(session: ChatSession): boolean {
  return !session.archived;
}

/** The ready worktrees that at least one listed session works in. */
export function joinableWorktrees(
  environments: readonly WorkEnvironment[],
  sessions: readonly ChatSession[],
): JoinableWorktree[] {
  return environments
    .filter((environment) => environment.kind === "worktree" && environment.setupStatus === "ready")
    .map((environment) => ({
      environment,
      sessions: sessions
        .filter((session) => isListed(session) && session.environmentId === environment.id)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    }))
    .filter((worktree) => worktree.sessions.length > 0);
}

/** How many listed sessions work in the environment `environmentId`. */
export function countSharers(
  sessions: readonly ChatSession[],
  environmentId: string | undefined,
): number {
  if (!environmentId) return 0;
  return sessions.filter((session) => isListed(session) && session.environmentId === environmentId)
    .length;
}
