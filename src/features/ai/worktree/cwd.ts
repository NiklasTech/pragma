import type { ChatSession } from "@/shared/stores/ai";

export function sessionCwd(
  session: Pick<ChatSession, "worktree"> | undefined,
  workspaceRoot: string,
): string {
  if (session?.worktree?.status === "ready") return session.worktree.path;
  return workspaceRoot;
}
