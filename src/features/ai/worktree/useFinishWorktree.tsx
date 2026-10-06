import { useCallback, useState, type ReactNode } from "react";
import { GitMerge } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { CreatePullRequestDialog } from "@/features/sidebar/components/git-status/CreatePullRequestDialog";
import { commitMessageFor } from "@/features/ai/review/commit";
import { useTasksStore } from "@/features/ai/tasks/store";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { loadSessionMessages } from "@/shared/lib/chat-storage";
import { useAIStore, type ChatSession, type SessionWorktree } from "@/shared/stores/ai";
import { useGitStore } from "@/shared/stores/git";

import {
  finishSessionMerge,
  openCheckoutConflicts,
  pullRequestBody,
  pushSessionBranch,
  type FinishAction,
  type SessionMergeStrategy,
} from "./finish";
import { removeSessionWorktree } from "./remove";

interface MergedSession {
  sessionId: string;
  worktree: SessionWorktree;
  target: string;
}

interface PullRequestDraft {
  worktree: SessionWorktree;
  title: string;
  body: string;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** The Finish actions of a worktree session and the dialogs they open. */
export function useFinishWorktree(rootPath: string): {
  finish: (sessionId: string, action: FinishAction) => void;
  dialogs: ReactNode;
} {
  const [merged, setMerged] = useState<MergedSession | null>(null);
  const [deleteBranch, setDeleteBranch] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [draft, setDraft] = useState<PullRequestDraft | null>(null);

  const merge = useCallback(
    async (session: ChatSession, worktree: SessionWorktree, strategy: SessionMergeStrategy) => {
      const toastId = toast.loading(`Merging ${worktree.branch}…`);
      try {
        const result = await finishSessionMerge(rootPath, worktree, strategy);
        const git = useGitStore.getState();
        if (git.repoPath === rootPath) void git.refreshAll();

        if (result.completed) {
          toast.success(`Merged ${worktree.branch} into ${result.target}`, { id: toastId });
          setDeleteBranch(true);
          setMerged({ sessionId: session.id, worktree, target: result.target });
        } else if (result.rebase_conflicts) {
          toast.error(
            `Rebasing onto ${result.target} conflicts in ${plural(result.conflicts.length, "file")}`,
            {
              id: toastId,
              description: "The rebase was undone. Merge instead to resolve the conflicts.",
              action: { label: "Merge", onClick: () => void merge(session, worktree, "merge") },
            },
          );
        } else {
          toast.error(
            `Merging into ${result.target} conflicts in ${plural(result.conflicts.length, "file")}`,
            {
              id: toastId,
              description: "Resolve the conflicts, then commit the merge.",
            },
          );
          await openCheckoutConflicts(rootPath);
        }
      } catch (err) {
        toast.error(String(err), { id: toastId });
      }
    },
    [rootPath],
  );

  const openPullRequest = useCallback(
    async (session: ChatSession, worktree: SessionWorktree) => {
      const task = useTasksStore.getState().tasks.find((item) => item.sessionId === session.id);
      try {
        const messages =
          session.messages.length > 0
            ? session.messages
            : await loadSessionMessages(rootPath, session.id);
        setDraft({
          worktree,
          title: commitMessageFor(task?.title ?? null, session.title),
          body: pullRequestBody(task?.notes ?? null, messages),
        });
      } catch (err) {
        toast.error(String(err));
      }
    },
    [rootPath],
  );

  const finish = useCallback(
    (sessionId: string, action: FinishAction) => {
      const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
      const worktree = session?.worktree;
      if (!session || !worktree) return;
      if (action === "pull-request") void openPullRequest(session, worktree);
      else void merge(session, worktree, action);
    },
    [merge, openPullRequest],
  );

  const cleanUp = async () => {
    if (!merged) return;
    const session = useAIStore.getState().chatSessions.find((item) => item.id === merged.sessionId);
    if (!session?.worktree) {
      setMerged(null);
      return;
    }
    setRemoving(true);
    try {
      const removed = await removeSessionWorktree(rootPath, session, false);
      if (removed && deleteBranch) {
        await invoke("git_session_delete_branch", {
          repoPath: rootPath,
          branch: merged.worktree.branch,
        });
      }
      const git = useGitStore.getState();
      if (git.repoPath === rootPath) void git.loadBranches();
      setMerged(null);
    } catch (err) {
      toast.error(`Could not remove the worktree: ${String(err)}`);
    } finally {
      setRemoving(false);
    }
  };

  const dialogs = (
    <>
      <AlertDialog
        open={merged !== null}
        onOpenChange={(open) => {
          if (!open && !removing) setMerged(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <GitMerge size={20} className="text-status-success" />
            </AlertDialogMedia>
            <AlertDialogTitle>Remove the worktree?</AlertDialogTitle>
            <AlertDialogDescription>
              {merged
                ? `${merged.worktree.branch} is merged into ${merged.target}. Remove the worktree at ${merged.worktree.path}? The thread keeps running in the checkout.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex cursor-pointer items-center gap-2 text-ui-sm text-fg-muted select-none">
            <Checkbox
              checked={deleteBranch}
              onCheckedChange={(checked) => setDeleteBranch(checked)}
              disabled={removing}
            />
            Also delete the branch
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Keep</AlertDialogCancel>
            <Button size="default" onClick={() => void cleanUp()} disabled={removing}>
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {draft && (
        <CreatePullRequestDialog
          open
          onOpenChange={(open) => {
            if (!open) setDraft(null);
          }}
          repoPath={draft.worktree.path}
          currentBranch={draft.worktree.branch}
          defaultTitle={draft.title}
          defaultBody={draft.body}
          pushBranch={() => pushSessionBranch(rootPath, draft.worktree)}
          onCreated={() => setDraft(null)}
        />
      )}
    </>
  );

  return { finish, dialogs };
}
