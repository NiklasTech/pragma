import type { GhPullRequest } from "@/shared/stores/github";

const ACTIVE_MS = 30_000;
const SETTLED_MS = 120_000;

/** How often to look at the checks: often while they run or have not appeared, else now and then. */
export function checksPollMs(pullRequest: GhPullRequest | null): number | null {
  if (!pullRequest || pullRequest.state !== "OPEN") return null;
  const { total, pending } = pullRequest.checks;
  // Right after a push the new commit has no checks yet, and an agent may push at any time.
  return total === 0 || pending > 0 ? ACTIVE_MS : SETTLED_MS;
}
