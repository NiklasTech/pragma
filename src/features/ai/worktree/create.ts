import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useAIStore, type ChatSession, type WorkEnvironment } from "@/shared/stores/ai";

import type { WorktreeChoice } from "./choice";

interface WorktreeCreateResponse {
  branch: string;
  base_branch: string | null;
  path: string;
  setup_log: string;
  status: "ready" | "error";
}

/** Creates a worktree from `baseBranch` (default: the checkout's HEAD) and stores it as a work environment. */
export async function createWorktreeEnvironment(
  rootPath: string,
  baseBranch?: string,
): Promise<WorkEnvironment> {
  const id = crypto.randomUUID();
  const created = await invoke<WorktreeCreateResponse>("git_session_worktree_create", {
    repoPath: rootPath,
    environmentId: id,
    baseBranch: baseBranch ?? null,
  });
  const environment: WorkEnvironment = {
    id,
    kind: "worktree",
    path: created.path,
    branch: created.branch,
    setupStatus: created.status,
    setupLog: created.setup_log,
  };
  if (created.base_branch) environment.baseBranch = created.base_branch;
  await useAIStore.getState().saveEnvironment(rootPath, environment);
  return environment;
}

export async function createSessionForChoice(
  rootPath: string,
  choice: WorktreeChoice,
): Promise<ChatSession | null> {
  const { createChatSession } = useAIStore.getState();

  if (choice === "checkout") {
    return createChatSession(rootPath, { kind: "agent", environment: "checkout" });
  }

  let environment: WorkEnvironment;
  try {
    environment = await createWorktreeEnvironment(rootPath);
  } catch {
    toast.error("Could not create a worktree for this thread");
    return null;
  }

  return createChatSession(rootPath, {
    kind: "agent",
    environment: "worktree",
    environmentId: environment.id,
  });
}
