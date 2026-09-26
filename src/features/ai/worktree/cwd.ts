import type { ChatSession } from "@/shared/stores/ai";

export function sessionCwd(session: ChatSession | undefined, workspaceRoot: string): string {
  if (session?.worktree?.status === "ready") return session.worktree.path;
  return workspaceRoot;
}
