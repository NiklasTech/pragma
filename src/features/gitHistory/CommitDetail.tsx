import { useEffect, useState } from "react";
import { GitPullRequest, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { useGitStore, type GitCommitDetails, type GitCommitFileChange } from "@/shared/stores/git";
import { useOverlayStore } from "@/shared/stores/overlays";
import { FileChangeRow } from "@/features/sidebar/components/GitCommitDetailsDialog";
import { openGitDiffInSplit } from "@/features/sidebar/lib/gitDiffSplit";
import { useWorktreeAgent } from "@/features/sidebar/worktrees/useWorktreeAgent";
import type { RepositoryWorktree } from "@/features/sidebar/worktrees/worktreeView";

import { authorInitial, relativeTime, splitPullRequest } from "./historyModel";

const STATE_HEADLINE = {
  "needs-you": "needs you",
  working: "is still working",
  done: "is done",
  idle: "is idle",
} as const;

function Avatar({ author }: { author: string }) {
  return (
    <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-bg-active text-[9.5px] font-semibold text-fg-default">
      {authorInitial(author)}
    </span>
  );
}

function AgentHeadline({ worktree, count }: { worktree: RepositoryWorktree; count: number }) {
  const { manifest, name, state } = useWorktreeAgent(worktree.sessionId);
  const openOverlay = useOverlayStore((store) => store.open);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AgentMark agentId={manifest?.id} name={name} />
        <span className="text-[14px] font-semibold text-fg-default">
          {name} {STATE_HEADLINE[state]}
        </span>
      </div>
      <p className="text-ui-sm leading-relaxed text-fg-muted">
        {count} {count === 1 ? "commit" : "commits"} on{" "}
        <span className="font-mono text-ui-xs text-fg-default">{worktree.environment.branch}</span>,
        not merged yet.
      </p>
      {worktree.sessionId && (
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => worktree.sessionId && openOverlay("peek", worktree.sessionId)}
          >
            Peek at {name}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => worktree.sessionId && openOverlay("review", worktree.sessionId)}
          >
            Review
          </Button>
        </div>
      )}
    </div>
  );
}

interface CommitDetailProps {
  sha: string;
  /** Lines the commit added and removed, from the log; the details carry no line counts. */
  stat: { added: number; removed: number };
  /** Set when the commit is on an agent's branch that is not merged yet. */
  agent?: { worktree: RepositoryWorktree; count: number };
  onDone?: () => void;
}

/// The selected commit: message, author, pull request, files, and what to do with it.
export function CommitDetail({ sha, stat, agent, onDone }: CommitDetailProps) {
  const loadCommitDetails = useGitStore((state) => state.loadCommitDetails);
  const loadCommitFileDiff = useGitStore((state) => state.loadCommitFileDiff);
  const createBranchFromCommit = useGitStore((state) => state.createBranchFromCommit);
  const revertCommit = useGitStore((state) => state.revertCommit);
  const editorPanelId = useEditorPanelId();
  const [details, setDetails] = useState<{ sha: string; value: GitCommitDetails | null } | null>(
    null,
  );
  const [loadingPath, setLoadingPath] = useState<string | null>(null);
  const [branchOpen, setBranchOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void loadCommitDetails(sha)
      .then((value) => live && setDetails({ sha, value }))
      .catch(() => live && setDetails({ sha, value: null }));
    return () => {
      live = false;
    };
  }, [sha, loadCommitDetails]);

  const shown = details?.sha === sha ? details.value : undefined;

  const openDiff = async (commit: GitCommitDetails, file: GitCommitFileChange) => {
    setLoadingPath(file.path);
    try {
      const result = await loadCommitFileDiff(commit.sha, file.path, file.original_path);
      if (!result) return;
      if (result.is_binary) {
        toast.info("Binary file, no diff available");
        return;
      }
      openGitDiffInSplit(editorPanelId, {
        id: `diff:${commit.sha}:${file.path}`,
        name: `${file.path.split("/").pop() ?? file.path} (${commit.short_sha})`,
        path: file.path,
        original: result.original_content,
        modified: result.modified_content,
        patchText: result.fallback_patch,
        staged: false,
      });
      onDone?.();
    } finally {
      setLoadingPath(null);
    }
  };

  if (shown === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-ui-sm text-fg-muted">
        <Spinner size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
        Loading the commit…
      </div>
    );
  }
  if (shown === null) {
    return (
      <p className="flex flex-1 items-center justify-center text-ui-sm text-fg-muted">
        Could not load this commit.
      </p>
    );
  }

  const { title, pr } = splitPullRequest(shown.subject);

  return (
    <>
      <div className="flex shrink-0 flex-col gap-2.5 px-5 pt-5 pb-3.5 select-text">
        {agent && <AgentHeadline worktree={agent.worktree} count={agent.count} />}
        <h3 className="text-[15px] leading-snug font-semibold text-fg-default">{title}</h3>
        <div className="flex flex-wrap items-center gap-2 text-ui-sm text-fg-muted">
          <Avatar author={shown.author} />
          <span title={shown.author_email}>
            {shown.author} · {relativeTime(shown.timestamp_secs, Date.now() / 1000)}
          </span>
          <span className="font-mono text-ui-xs text-fg-subtle">{shown.short_sha}</span>
          {pr !== null && (
            <span className="flex h-5.5 items-center gap-1.5 rounded-[6px] bg-bg-hover px-2 text-ui-xs">
              <GitPullRequest size={11} aria-hidden="true" />#{pr}
            </span>
          )}
        </div>
        {shown.body && (
          <p className="max-h-40 overflow-y-auto text-ui-sm leading-relaxed whitespace-pre-wrap text-fg-muted">
            {shown.body}
          </p>
        )}
      </div>
      <div className="border-t border-border-subtle px-5 pt-3 pb-1 text-ui-xs font-medium text-fg-subtle">
        {shown.files.length === 0 && shown.parents.length > 1
          ? "A merge commit; its changes are on the merged branch"
          : `${shown.files.length} ${shown.files.length === 1 ? "file" : "files"} · +${stat.added} −${stat.removed}`}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        {shown.files.map((file) => (
          <FileChangeRow
            key={file.path}
            file={file}
            loading={loadingPath === file.path}
            onClick={() => void openDiff(shown, file)}
          />
        ))}
      </div>
      <div className="flex shrink-0 gap-1.5 border-t border-border-subtle px-4 py-3.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={shown.files.length === 0}
          onClick={() => void openDiff(shown, shown.files[0])}
        >
          Open diff
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setBranchOpen(true)}>
          Create branch here
        </Button>
        {!agent && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setRevertOpen(true)}>
            Revert
          </Button>
        )}
      </div>

      <InputDialog
        open={branchOpen}
        onOpenChange={setBranchOpen}
        title="Create branch"
        description={`A new branch that starts at ${shown.short_sha}. You stay on your current branch.`}
        label="Branch name"
        confirmLabel="Create"
        onConfirm={(name) => {
          if (name.trim()) void createBranchFromCommit(name.trim(), shown.sha, false);
        }}
      />
      <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert this commit?</AlertDialogTitle>
            <AlertDialogDescription>
              A new commit on your current branch undoes {shown.short_sha}, "{title}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void revertCommit(shown.sha)}>
              Revert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
