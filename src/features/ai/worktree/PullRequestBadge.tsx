import { GitPullRequest } from "@phosphor-icons/react";

import type { EnvironmentPullRequest } from "@/shared/stores/ai";

/** The state of a session's pull request once it is no longer open. */
export function PullRequestBadge({
  pullRequest,
}: {
  pullRequest: EnvironmentPullRequest | undefined;
}) {
  if (!pullRequest || pullRequest.state === "OPEN") return null;
  const state = pullRequest.state === "MERGED" ? "merged" : "closed";
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 tabular-nums"
      title={`Pull request #${pullRequest.number} was ${state}`}
      aria-label={`Pull request #${pullRequest.number} was ${state}`}
    >
      <GitPullRequest size={11} className="shrink-0" />#{pullRequest.number} {state}
    </span>
  );
}
