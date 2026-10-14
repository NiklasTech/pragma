import { invoke } from "@tauri-apps/api/core";

import { useAIStore, type EnvironmentPullRequest, type WorkEnvironment } from "@/shared/stores/ai";
import type { GhPullRequest } from "@/shared/stores/github";

import { autoRemoveWorktrees, releaseWorktree } from "./cleanup";
import { isGhReady } from "./finish";

const PULL_REQUEST_URL = /\/pull\/(\d+)\/?$/;

/** The open pull request a `gh pr create` URL points to, or null when it names no number. */
export function pullRequestFromUrl(url: string): EnvironmentPullRequest | null {
  const trimmed = url.trim();
  const number = Number(PULL_REQUEST_URL.exec(trimmed)?.[1] ?? 0);
  return number > 0 ? { number, url: trimmed, state: "OPEN" } : null;
}

/** Remembers the pull request opened for a worktree's branch. */
export async function rememberPullRequest(
  rootPath: string,
  environmentId: string,
  url: string,
): Promise<void> {
  const pullRequest = pullRequestFromUrl(url);
  const store = useAIStore.getState();
  const environment = store.workEnvironments.find((item) => item.id === environmentId);
  if (!pullRequest || !environment) return;
  await store.saveEnvironment(rootPath, { ...environment, pullRequest });
}

const checking = new Set<string>();
// Dirty or failed removals toast, so they are retried once per app run, not on every focus.
const attempted = new Set<string>();

async function fetchState(
  rootPath: string,
  pullRequest: EnvironmentPullRequest,
): Promise<EnvironmentPullRequest["state"] | null> {
  try {
    const fetched = await invoke<GhPullRequest | null>("gh_pr_current", {
      repoPath: rootPath,
      number: pullRequest.number,
    });
    return fetched?.state ?? null;
  } catch {
    return null;
  }
}

async function checkEnvironment(rootPath: string, environment: WorkEnvironment): Promise<void> {
  const pullRequest = environment.pullRequest;
  if (!pullRequest) return;
  let state = pullRequest.state;
  if (state === "OPEN") {
    const fetched = await fetchState(rootPath, pullRequest);
    if (!fetched || fetched === state) return;
    state = fetched;
    await useAIStore
      .getState()
      .saveEnvironment(rootPath, { ...environment, pullRequest: { ...pullRequest, state } });
  }
  if (state !== "MERGED" || !autoRemoveWorktrees() || attempted.has(environment.id)) return;

  // The merged pull request finishes every session on its branch; running ones still keep it.
  const finishedIds = new Set(
    useAIStore
      .getState()
      .chatSessions.filter((session) => session.environmentId === environment.id)
      .map((session) => session.id),
  );
  const release = await releaseWorktree(rootPath, environment.id, finishedIds, false, true);
  if (release === "dirty" || release === "failed") attempted.add(environment.id);
}

/** Updates the state of each session pull request through `gh` and cleans up merged ones. */
export async function checkSessionPullRequests(rootPath: string): Promise<void> {
  if (rootPath === "default" || checking.has(rootPath)) return;
  checking.add(rootPath);
  try {
    const tracked = useAIStore
      .getState()
      .workEnvironments.filter(
        (environment) =>
          environment.rootPath === rootPath &&
          environment.kind === "worktree" &&
          environment.pullRequest &&
          environment.pullRequest.state !== "CLOSED",
      );
    if (tracked.length === 0 || !(await isGhReady(rootPath))) return;
    for (const environment of tracked) {
      await checkEnvironment(rootPath, environment);
    }
  } finally {
    checking.delete(rootPath);
  }
}
