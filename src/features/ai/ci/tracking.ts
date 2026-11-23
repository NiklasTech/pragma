import { useAIStore, type EnvironmentPullRequest, type WorkEnvironment } from "@/shared/stores/ai";

import { runningRepositorySessions } from "../sessions/runningSessions";
import { isGhReady } from "../worktree/finish";
import { fetchBranchPullRequest, fetchPullRequestChecks } from "./api";
import { reactToCi } from "./reaction";
import { ciStatus } from "./status";
import { pruneAgentCi, setAgentCi, useAgentCiStore } from "./store";

const checking = new Set<string>();

/** The open pull request of a worktree; one the agent opened itself is found by its branch. */
async function openPullRequest(
  rootPath: string,
  environment: WorkEnvironment,
): Promise<EnvironmentPullRequest | null> {
  if (environment.pullRequest) {
    return environment.pullRequest.state === "OPEN" ? environment.pullRequest : null;
  }
  const found = await fetchBranchPullRequest(environment.path).catch(() => null);
  if (!found || found.state !== "OPEN") return null;
  const pullRequest: EnvironmentPullRequest = {
    number: found.number,
    url: found.url,
    state: "OPEN",
  };
  await useAIStore
    .getState()
    .saveEnvironment(rootPath, { ...environment, pullRequest })
    .catch(() => {});
  return pullRequest;
}

/**
 * Looks up the pull request and checks of every agent worktree with a running session.
 * Returns whether any checks are still running, so the caller can look again sooner.
 */
export async function checkAgentPullRequests(rootPath: string): Promise<boolean> {
  if (rootPath === "default" || checking.has(rootPath)) return false;
  checking.add(rootPath);
  try {
    const environments = useAIStore
      .getState()
      .workEnvironments.filter(
        (environment) => environment.rootPath === rootPath && environment.kind === "worktree",
      );
    const running = new Set(
      runningRepositorySessions(rootPath).map((session) => session.environmentId),
    );
    const tracked = environments.filter((environment) => running.has(environment.id));
    const kept = new Set<string>();
    let pending = false;

    if (tracked.length > 0 && (await isGhReady(rootPath))) {
      for (const environment of tracked) {
        const pullRequest = await openPullRequest(rootPath, environment);
        if (!pullRequest) continue;
        kept.add(environment.id);
        const checks = await fetchPullRequestChecks(rootPath, pullRequest.number).catch(() => null);
        // A failed lookup keeps what was known before.
        if (checks === null) continue;
        const status = ciStatus(checks);
        if (status?.state === "pending") pending = true;
        const previous = useAgentCiStore.getState().byEnvironment[environment.id]?.status;
        setAgentCi(environment.id, {
          number: pullRequest.number,
          url: pullRequest.url,
          status,
        });
        await reactToCi(rootPath, environment.id, pullRequest.number, previous, status).catch(
          () => {},
        );
      }
    }

    pruneAgentCi(
      environments.map((environment) => environment.id),
      kept,
    );
    return pending;
  } finally {
    checking.delete(rootPath);
  }
}
