"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Trash, Warning } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

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
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useAgentStore } from "@/features/agent/store";

interface DiscardWorktreeDialogProps {
  session: ChatSession | null;
  rootPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TeardownResult {
  ok: boolean;
  log: string;
}

export function DiscardWorktreeDialog({
  session,
  rootPath,
  open,
  onOpenChange,
}: DiscardWorktreeDialogProps) {
  const [deleteBranch, setDeleteBranch] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState<"confirm" | "force">("confirm");
  const preparedForRef = useRef<string | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const sessionId = session?.id ?? null;
  const worktreePath = session?.worktree?.path ?? null;

  useEffect(() => {
    if (!open || !sessionId || !worktreePath) {
      if (!open) preparedForRef.current = null;
      return;
    }
    if (preparedForRef.current === sessionId) return;
    preparedForRef.current = sessionId;

    let cancelled = false;
    setDeleteBranch(false);
    setPreparing(true);
    setBusy(false);
    setDirty(false);
    setStep("confirm");

    void (async () => {
      try {
        const isDirty = await invoke<boolean>("git_session_worktree_dirty", {
          path: worktreePath,
        });
        if (cancelled) return;
        setDirty(isDirty);
      } catch {
        if (cancelled) return;
        toast.error("Could not check the worktree");
        onOpenChangeRef.current(false);
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, sessionId, worktreePath, rootPath]);

  const removeWorktree = useCallback(
    async (force: boolean) => {
      if (!session || !session.worktree) return;

      setBusy(true);
      try {
        const agent = useAgentStore.getState();
        if (agent.runSessionId === session.id) agent.requestStop();

        const teardown = await invoke<TeardownResult>("git_session_worktree_teardown", {
          repoPath: rootPath,
          worktreePath: session.worktree.path,
        });
        if (!teardown.ok) {
          toast.error(teardown.log || "Could not tear down the worktree");
          onOpenChange(false);
          return;
        }

        await invoke("git_session_worktree_remove", {
          repoPath: rootPath,
          worktreePath: session.worktree.path,
          force,
        });

        if (deleteBranch) {
          const merged = await invoke<boolean>("git_session_branch_merged", {
            repoPath: rootPath,
            branch: session.worktree.branch,
          });
          if (!merged) {
            await invoke("git_session_delete_branch", {
              repoPath: rootPath,
              branch: session.worktree.branch,
            });
          }
        }

        await useAIStore.getState().updateChatSession(rootPath, {
          ...session,
          environment: "checkout",
          worktree: null,
          updatedAt: Date.now(),
        });
        onOpenChange(false);
      } catch {
        toast.error("Could not remove the worktree");
      } finally {
        setBusy(false);
      }
    },
    [deleteBranch, onOpenChange, rootPath, session],
  );

  const handleConfirm = useCallback(() => {
    if (dirty) {
      setStep("force");
      return;
    }
    void removeWorktree(false);
  }, [dirty, removeWorktree]);

  return (
    <>
      <AlertDialog
        open={open && step === "confirm"}
        onOpenChange={(next) => {
          if (!next && !busy) onOpenChange(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash size={20} className="text-status-error" />
            </AlertDialogMedia>
            <AlertDialogTitle>Discard worktree?</AlertDialogTitle>
            <AlertDialogDescription>
              {session?.worktree
                ? `Branch ${session.worktree.branch}. Path ${session.worktree.path}. `
                : ""}
              {preparing
                ? "Checking the worktree..."
                : dirty
                  ? "This worktree has uncommitted changes. Continuing will require an extra confirmation."
                  : "The worktree is removed and this thread keeps running in the checkout."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex cursor-pointer items-center gap-2 text-ui-sm text-fg-muted select-none">
            <Checkbox
              checked={deleteBranch}
              onCheckedChange={(checked) => setDeleteBranch(checked)}
              disabled={busy}
            />
            Also delete the branch
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              size="default"
              onClick={handleConfirm}
              disabled={preparing || busy}
            >
              {dirty ? "Continue" : "Discard"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={open && step === "force"}
        onOpenChange={(next) => {
          if (!next && !busy) onOpenChange(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Warning size={20} className="text-status-warning" />
            </AlertDialogMedia>
            <AlertDialogTitle>Uncommitted changes</AlertDialogTitle>
            <AlertDialogDescription>
              Removing this worktree discards all uncommitted changes permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              size="default"
              onClick={() => void removeWorktree(true)}
              disabled={busy}
            >
              Delete anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
