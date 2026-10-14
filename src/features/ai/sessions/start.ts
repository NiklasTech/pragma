import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import {
  repositorySessions,
  useAIStore,
  type ChatSession,
  type CreateChatSessionInit,
  type WorkEnvironment,
} from "@/shared/stores/ai";
import { useWorkspaceSettingsStore } from "@/shared/stores/workspaceSettings/store";

import { isWritingSession } from "../children/limits";
import { createWorktreeEnvironment } from "../worktree/create";
import { discardWorktreeEnvironment } from "../worktree/remove";
import { resolveEnvironment, type EnvironmentChoice } from "./environment";

interface RepoCheckResult {
  is_repo: boolean;
}

export interface StartSessionRequest {
  init: Omit<CreateChatSessionInit, "environment" | "environmentId">;
  /** Wins over the project setting; ignored for Ask sessions and outside a git repository. */
  environment?: EnvironmentChoice;
  /** Joins the environment of this session instead of resolving one. */
  sameEnvironmentAs?: Pick<ChatSession, "environment" | "environmentId">;
  /** Fails instead of falling back to the checkout when no ready worktree can be made. */
  requireWorktree?: boolean;
  activate?: boolean;
}

async function isGitRepo(rootPath: string): Promise<boolean> {
  try {
    const result = await invoke<RepoCheckResult>("git_session_repo_check", { repoPath: rootPath });
    return result.is_repo;
  } catch {
    return false;
  }
}

function writingSessionsSetting(rootPath: string): EnvironmentChoice | undefined {
  const workspace = useWorkspaceSettingsStore.getState();
  return workspace.rootPath === rootPath ? workspace.settings?.agent?.writingSessions : undefined;
}

async function resolveChoice(
  rootPath: string,
  request: StartSessionRequest,
): Promise<EnvironmentChoice> {
  const kind = request.init.kind;
  return resolveEnvironment({
    kind,
    override: request.environment,
    setting: writingSessionsSetting(rootPath),
    isRepo: isWritingSession({ kind }) && (await isGitRepo(rootPath)),
    sessions: repositorySessions(useAIStore.getState().chatSessions, rootPath),
  });
}

async function prepareWorktree(rootPath: string, requireReady: boolean): Promise<WorkEnvironment> {
  let environment: WorkEnvironment;
  try {
    environment = await createWorktreeEnvironment(rootPath);
  } catch (err) {
    throw new Error(`Could not create a worktree: ${String(err)}`);
  }
  if (environment.setupStatus === "ready") return environment;
  if (requireReady) {
    await discardWorktreeEnvironment(rootPath, environment);
    throw new Error("The worktree setup script failed");
  }
  const lastLine = environment.setupLog.trim().split("\n").pop();
  toast.error("The worktree setup script failed", { description: lastLine || undefined });
  return environment;
}

/** Creates a session in the environment the caller, the project setting and the checkout call for. */
export async function startSession(
  rootPath: string,
  request: StartSessionRequest,
): Promise<ChatSession> {
  const { createChatSession } = useAIStore.getState();
  const options = { activate: request.activate };
  const source = request.sameEnvironmentAs;
  if (source) {
    return createChatSession(
      rootPath,
      { ...request.init, environment: source.environment, environmentId: source.environmentId },
      options,
    );
  }

  const choice = await resolveChoice(rootPath, request);
  if (choice === "checkout") {
    if (request.requireWorktree) throw new Error("This folder is not a git repository");
    return createChatSession(rootPath, { ...request.init, environment: "checkout" }, options);
  }

  const environment = await prepareWorktree(rootPath, request.requireWorktree === true);
  return createChatSession(
    rootPath,
    { ...request.init, environment: "worktree", environmentId: environment.id },
    options,
  );
}
