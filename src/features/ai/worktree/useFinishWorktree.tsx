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
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { loadSessionMessages } from "@/shared/lib/chat-storage";
import { useAIStore, type ChatSession, type WorkEnvironment } from "@/shared/stores/ai";
import { useGitStore } from "@/shared/stores/git";

import {
  commitBeforeFinish,
  finishSessionMerge,
  openCheckoutConflicts,
  parentMergeTarget,
  pullRequestBody,
  pushSessionBranch,
  type FinishAction,
  type SessionMergeStrategy,
} from "./finish";
import { autoRemoveWorktrees, releaseWorktree } from "./cleanup";
import { sessionEnvironment } from "./cwd";
import { rememberPullRequest } from "./pullRequests";
import { removeSessionWorktree } from "./remove";

interface MergedSession {
  sessionId: string;
  worktree: WorkEnvironment;
  target: string;
}

interface PullRequestDraft {
  worktree: WorkEnvironment;
  title: string;
  body: string;
}

interface CommitPrompt {
  message: string;
  resolve: (message: string | null) => void;
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
  const [commitPrompt, setCommitPrompt] = useState<CommitPrompt | null>(null);

  const promptCommitMessage = useCallback(
    (message: string) =>
      new Promise<string | null>((resolve) => setCommitPrompt({ message, resolve })),
    [],
  );

  const merge = useCallback(
    async (session: ChatSession, worktree: WorkEnvironment, strategy: SessionMergeStrategy) => {
      const toastId = toast.loading(`Merging ${worktree.branch}…`);
      try {
        const parentBranch = parentMergeTarget(worktree, useAIStore.getState().workEnvironments);
        const result = await finishSessionMerge(rootPath, worktree, strategy, parentBranch);
        const git = useGitStore.getState();
        if (git.repoPath === rootPath) void git.refreshAll();

        if (result.completed) {
          toast.success(`Merged ${worktree.branch} into ${result.target}`, { id: toastId });
          if (autoRemoveWorktrees()) {
            const release = await releaseWorktree(rootPath, worktree.id, new Set([session.id]));
            if (release === "in-use")
              toast.info("Kept the worktree because a session still uses it");
          } else {
            setDeleteBranch(true);
            setMerged({ sessionId: session.id, worktree, target: result.target });
          }
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
              description: parentBranch
                ? "Resolve the conflicts in the parent's worktree, then commit the merge."
                : "Resolve the conflicts, then commit the merge.",
            },
          );
          if (!parentBranch) await openCheckoutConflicts(rootPath);
        }
      } catch (err) {
        toast.error(String(err), { id: toastId });
      }
    },
    [rootPath],
  );

  const openPullRequest = useCallback(
    async (session: ChatSession, worktree: WorkEnvironment) => {
      const task = useTasksStore.getState().tasks.find((item) => item.sessionId === session.id);
      try {
        const messages =
          session.messages.length > 0
            ? session.messages
            : await loadSessionMessages(session.rootPath, session.id);
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
      const { chatSessions, workEnvironments } = useAIStore.getState();
      const session = chatSessions.find((item) => item.id === sessionId);
      const worktree = sessionEnvironment(session, workEnvironments);
      if (!session || worktree?.kind !== "worktree") return;
      const task = useTasksStore.getState().tasks.find((item) => item.sessionId === session.id);
      void (async () => {
        try {
          const ready = await commitBeforeFinish(
            rootPath,
            worktree,
            commitMessageFor(task?.title ?? null, session.title),
            promptCommitMessage,
          );
          if (!ready) return;
        } catch (err) {
          toast.error(String(err));
          return;
        }
        if (action === "pull-request") void openPullRequest(session, worktree);
        else void merge(session, worktree, action);
      })();
    },
    [merge, openPullRequest, promptCommitMessage, rootPath],
  );

  const cleanUp = async () => {
    if (!merged) return;
    const { chatSessions, workEnvironments } = useAIStore.getState();
    const session = chatSessions.find((item) => item.id === merged.sessionId);
    if (!session || !sessionEnvironment(session, workEnvironments)) {
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
      <InputDialog
        open={commitPrompt !== null}
        onOpenChange={(open) => {
          if (open) return;
          commitPrompt?.resolve(null);
          setCommitPrompt(null);
        }}
        title="Commit the uncommitted changes?"
        description="The session has uncommitted changes. They are committed to the session branch before finishing."
        label="Commit message"
        defaultValue={commitPrompt?.message ?? ""}
        confirmLabel="Commit and finish"
        onConfirm={(message) => commitPrompt?.resolve(message)}
      />

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
          onCreated={(url) => {
            void rememberPullRequest(rootPath, draft.worktree.id, url).catch(() => {});
            setDraft(null);
          }}
        />
      )}
    </>
  );

  return { finish, dialogs };
}
