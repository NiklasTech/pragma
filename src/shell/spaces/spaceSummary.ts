import type { AgentState } from "@/shared/components/ui/status-dot";
import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";
import type { Space } from "@/shared/stores/spaces/model";

export interface WorktreeRow {
  /** The environment id, or the folder itself for the main checkout. */
  id: string;
  branch: string;
  path: string;
  main: boolean;
  /** Sessions working in this worktree, newest first. */
  sessions: ChatSession[];
  pullRequest?: WorkEnvironment["pullRequest"];
}

/** The folder's own checkout first, then each worktree with the sessions that work in it. */
export function worktreeRows(
  folder: string,
  branch: string | null,
  environments: readonly WorkEnvironment[],
  sessions: readonly ChatSession[],
): WorktreeRow[] {
  const inFolder = sessions.filter((session) => session.rootPath === folder && !session.archived);
  const byNewest = (list: ChatSession[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  const worktrees = environments.filter(
    (environment) => environment.rootPath === folder && environment.kind === "worktree",
  );
  const main: WorktreeRow = {
    id: folder,
    branch: branch ?? "",
    path: folder,
    main: true,
    sessions: byNewest(inFolder.filter((session) => session.environment !== "worktree")),
  };
  return [
    main,
    ...worktrees.map((environment) => ({
      id: environment.id,
      branch: environment.branch,
      path: environment.path,
      main: false,
      sessions: byNewest(inFolder.filter((session) => session.environmentId === environment.id)),
      pullRequest: environment.pullRequest,
    })),
  ];
}

/** The state a space shows in the list: the most urgent state of its sessions. */
export function spaceState(
  space: Space,
  sessions: readonly ChatSession[],
  activity: { waiting: readonly string[]; running: readonly string[] },
): AgentState {
  const ids = sessions
    .filter((session) => space.folders.includes(session.rootPath))
    .map((session) => session.id);
  if (ids.some((id) => activity.waiting.includes(id))) return "needs-you";
  if (ids.some((id) => activity.running.includes(id))) return "working";
  return "idle";
}

/** "2 agents · 3 tabs" for the space list. */
export function spaceSubtitle(space: Space, sessionCount: number): string {
  const agents =
    sessionCount === 0 ? "no agents" : `${sessionCount} ${sessionCount === 1 ? "agent" : "agents"}`;
  return `${agents} · ${space.tabs.length} ${space.tabs.length === 1 ? "tab" : "tabs"}`;
}
