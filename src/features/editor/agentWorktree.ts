import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";

export interface AgentWorktree {
  /** The worktree's folder, used as the repository to compare the file against. */
  path: string;
  /** CLI manifest id of the agent working there, for its color. */
  agentId: string | undefined;
}

function normalize(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

/// The agent worktree a file lies in, and the agent whose session works there.
export function agentWorktreeFor(
  filePath: string,
  environments: readonly WorkEnvironment[],
  sessions: readonly ChatSession[],
): AgentWorktree | null {
  const file = normalize(filePath);
  const environment = environments.find((item) => {
    if (item.kind !== "worktree" || !item.path) return false;
    return file.startsWith(`${normalize(item.path)}/`);
  });
  if (!environment) return null;
  const working = sessions.filter(
    (session) => session.environmentId === environment.id && !session.archived,
  );
  const agent = working.find((session) => session.cliProviderId) ?? working[0];
  return { path: environment.path, agentId: agent?.cliProviderId };
}
