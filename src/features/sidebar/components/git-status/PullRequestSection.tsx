import { useEffect, useState } from "react";
import {
  ArrowsClockwise,
  ChatCircleText,
  CheckCircle,
  Clock,
  GitPullRequest,
  XCircle,
} from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useGitStore } from "@/shared/stores/git";
import { useGithubStore, type GhChecksSummary, type GhPullRequest } from "@/shared/stores/github";
import { sendReviewCommentsToAgent } from "../../lib/reviewTask";
import { CreatePullRequestDialog } from "./CreatePullRequestDialog";
import { ToolbarButton } from "./ToolbarButton";

const PENDING_POLL_MS = 30_000;

function StateBadge({ pr }: { pr: GhPullRequest }) {
  if (pr.state === "MERGED") return <Badge>Merged</Badge>;
  if (pr.state === "CLOSED") return <Badge variant="destructive">Closed</Badge>;
  if (pr.is_draft) return <Badge variant="secondary">Draft</Badge>;
  return <Badge variant="success">Open</Badge>;
}

function ChecksStatus({ checks }: { checks: GhChecksSummary }) {
  if (checks.total === 0) return null;
  const title = `${checks.passing} passing, ${checks.failing} failing, ${checks.pending} pending`;
  if (checks.failing > 0) {
    return (
      <span title={title} className="flex items-center gap-1 text-ui-2xs text-status-error">
        <XCircle size={12} weight="fill" />
        {checks.failing} failing
      </span>
    );
  }
  if (checks.pending > 0) {
    return (
      <span title={title} className="flex items-center gap-1 text-ui-2xs text-status-warning">
        <Clock size={12} weight="fill" />
        {checks.pending} pending
      </span>
    );
  }
  return (
    <span title={title} className="flex items-center gap-1 text-ui-2xs text-status-success">
      <CheckCircle size={12} weight="fill" />
      Checks passing
    </span>
  );
}

export function PullRequestSection() {
  const repoPath = useGitStore((state) => state.repoPath);
  const snapshot = useGitStore((state) => state.snapshot);
  const hasRemote = useGitStore((state) => state.remotes.length > 0);
  const lastCommitMessage = useGitStore((state) => state.commits[0]?.message ?? "");
  const cli = useGithubStore((state) => state.cli);
  const cliRepoPath = useGithubStore((state) => state.repoPath);
  const pullRequest = useGithubStore((state) => state.pullRequest);
  const prLoading = useGithubStore((state) => state.prLoading);
  const prError = useGithubStore((state) => state.prError);
  const loadCli = useGithubStore((state) => state.loadCli);
  const loadPullRequest = useGithubStore((state) => state.loadPullRequest);

  const [createOpen, setCreateOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const branch = snapshot && !snapshot.repo.is_detached ? snapshot.repo.branch : null;
  const upstream = snapshot?.repo.upstream ?? null;
  const ahead = snapshot?.ahead ?? 0;
  const enabled = Boolean(repoPath && cli?.authenticated && hasRemote && branch);

  useEffect(() => {
    if (repoPath && cliRepoPath !== repoPath) void loadCli(repoPath);
  }, [repoPath, cliRepoPath, loadCli]);

  useEffect(() => {
    if (!enabled || !repoPath || !branch) return;
    void loadPullRequest(repoPath, branch);
  }, [enabled, repoPath, branch, upstream, ahead, loadPullRequest]);

  const hasPendingChecks = (pullRequest?.checks.pending ?? 0) > 0;
  useEffect(() => {
    if (!enabled || !repoPath || !branch || !hasPendingChecks) return;
    const timer = window.setInterval(() => void loadPullRequest(repoPath, branch), PENDING_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, repoPath, branch, hasPendingChecks, loadPullRequest]);

  if (!cli?.installed || !repoPath) return null;

  if (!cli.authenticated) {
    return (
      <p className="px-2.5 pb-2 text-ui-2xs text-fg-subtle">
        Run <span className="font-mono">gh auth login</span> to enable pull requests.
      </p>
    );
  }

  if (!enabled || !branch) return null;

  const refresh = () => void loadPullRequest(repoPath, branch);

  const sendReview = async (pr: GhPullRequest) => {
    setSending(true);
    try {
      await sendReviewCommentsToAgent(repoPath, pr);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-1.5 px-2.5 pb-2">
      {pullRequest ? (
        <>
          <button
            type="button"
            onClick={() => void invoke("open_external_url", { url: pullRequest.url })}
            title={`Open #${pullRequest.number} on GitHub`}
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left text-ui-xs transition-colors hover:bg-bg-hover"
          >
            <GitPullRequest
              size={14}
              className={cn(
                "shrink-0",
                pullRequest.state === "OPEN" && !pullRequest.is_draft
                  ? "text-status-success"
                  : "text-fg-muted",
              )}
            />
            <span className="shrink-0 font-medium tabular-nums text-fg-muted">
              #{pullRequest.number}
            </span>
            <span className="min-w-0 truncate text-fg-default">{pullRequest.title}</span>
          </button>
          <StateBadge pr={pullRequest} />
          <ChecksStatus checks={pullRequest.checks} />
          <ToolbarButton
            icon={ChatCircleText}
            label="Send review comments to an agent"
            onClick={() => void sendReview(pullRequest)}
            busy={sending}
          />
        </>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 gap-1.5 text-ui-xs"
            disabled={prLoading}
            onClick={() => setCreateOpen(true)}
          >
            <GitPullRequest size={12} />
            Create pull request
          </Button>
          {prError && (
            <span title={prError} className="text-ui-2xs text-status-error">
              Status unavailable
            </span>
          )}
        </>
      )}
      <ToolbarButton
        icon={ArrowsClockwise}
        label="Refresh pull request status"
        onClick={refresh}
        busy={prLoading}
      />

      <CreatePullRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        repoPath={repoPath}
        currentBranch={branch}
        defaultTitle={lastCommitMessage}
        onCreated={refresh}
      />
    </div>
  );
}
