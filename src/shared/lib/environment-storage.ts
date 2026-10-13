import { invoke } from "@tauri-apps/api/core";

import type { WorkEnvironment } from "@/shared/stores/ai";

export interface StoredWorkEnvironment {
  id: string;
  kind: string;
  path: string;
  branch: string;
  base_branch?: string | null;
  setup_status: string;
  setup_log: string;
}

function toStoredEnvironment(environment: WorkEnvironment): StoredWorkEnvironment {
  const stored: StoredWorkEnvironment = {
    id: environment.id,
    kind: environment.kind,
    path: environment.path,
    branch: environment.branch,
    setup_status: environment.setupStatus,
    setup_log: environment.setupLog,
  };
  if (environment.baseBranch) stored.base_branch = environment.baseBranch;
  return stored;
}

export function fromStoredEnvironment(stored: StoredWorkEnvironment): WorkEnvironment {
  const environment: WorkEnvironment = {
    id: stored.id,
    kind: stored.kind === "checkout" ? "checkout" : "worktree",
    path: stored.path,
    branch: stored.branch,
    setupStatus: stored.setup_status === "error" ? "error" : "ready",
    setupLog: stored.setup_log,
  };
  if (stored.base_branch) environment.baseBranch = stored.base_branch;
  return environment;
}

export async function loadEnvironments(rootPath: string): Promise<WorkEnvironment[]> {
  const environments = await invoke<StoredWorkEnvironment[]>("ai_load_environments", {
    req: { root_path: rootPath || "default" },
  });
  return environments.map(fromStoredEnvironment);
}

export async function saveEnvironment(
  rootPath: string,
  environment: WorkEnvironment,
): Promise<void> {
  await invoke("ai_save_environment", {
    req: { root_path: rootPath || "default", environment: toStoredEnvironment(environment) },
  });
}

export async function deleteEnvironment(rootPath: string, environmentId: string): Promise<void> {
  await invoke("ai_delete_environment", {
    req: { root_path: rootPath || "default", environment_id: environmentId },
  });
}
