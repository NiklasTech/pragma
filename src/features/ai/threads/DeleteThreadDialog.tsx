"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Warning } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { outsideChildren, releaseChildren, stopSession } from "../children/release";
import { releaseWorktrees } from "../worktree/cleanup";

interface DeleteThreadDialogProps {
  sessions: ChatSession[];
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteThreadDialog({ sessions, onOpenChange, onDeleted }: DeleteThreadDialogProps) {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const workEnvironments = useAIStore((state) => state.workEnvironments);
  const deleteSession = useAIStore((state) => state.deleteSession);
  const [archiveChildren, setArchiveChildren] = useState(true);
  const [dirtyWorktree, setDirtyWorktree] = useState(false);

  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);
  const childCount = useMemo(
    () => outsideChildren(chatSessions, sessionIds).length,
    [chatSessions, sessionIds],
  );
  const isOpen = sessions.length > 0;
  const isBulk = sessions.length > 1;

  const worktreePaths = useMemo(() => {
    const ids = new Set(sessions.map((session) => session.environmentId));
    return workEnvironments
      .filter((environment) => environment.kind === "worktree" && ids.has(environment.id))
      .map((environment) => environment.path)
      .join("\n");
  }, [sessions, workEnvironments]);

  useEffect(() => {
    if (isOpen) setArchiveChildren(true);
  }, [isOpen]);

  useEffect(() => {
    setDirtyWorktree(false);
    if (!worktreePaths) return;
    let cancelled = false;
    void Promise.all(
      worktreePaths
        .split("\n")
        .map((path) => invoke<boolean>("git_session_worktree_dirty", { path }).catch(() => false)),
    ).then((dirty) => {
      if (!cancelled) setDirtyWorktree(dirty.some(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [worktreePaths]);

  const handleConfirm = useCallback(async () => {
    if (sessionIds.length === 0) return;
    try {
      const roots = [...new Set(sessions.map((session) => session.rootPath))];
      const inRoot = (root: string) => sessions.filter((session) => session.rootPath === root);
      if (childCount > 0) {
        for (const root of roots) {
          const ids = inRoot(root).map((session) => session.id);
          await releaseChildren(root, ids, archiveChildren);
        }
      }
      for (const sessionId of sessionIds) {
        stopSession(sessionId);
        await deleteSession(sessionId);
      }
      onOpenChange(false);
      onDeleted?.();
      for (const root of roots) await releaseWorktrees(root, inRoot(root));
    } catch {
      toast.error(isBulk ? "Failed to delete threads" : "Failed to delete thread");
    }
  }, [
    archiveChildren,
    childCount,
    deleteSession,
    isBulk,
    onDeleted,
    onOpenChange,
    sessionIds,
    sessions,
  ]);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Warning size={20} className="text-status-warning" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {isBulk ? `Delete ${sessions.length} threads?` : "Delete thread?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk
              ? `Are you sure you want to delete ${sessions.length} threads?`
              : `Are you sure you want to delete "${sessions[0]?.title ?? ""}"?`}{" "}
            This action cannot be undone.
            {dirtyWorktree &&
              (isBulk
                ? " A worktree of these threads has uncommitted changes. Pragma keeps it so they are not lost."
                : " Its worktree has uncommitted changes. Pragma keeps it so they are not lost.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {childCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-ui-sm text-fg-muted select-none">
            <Checkbox
              checked={archiveChildren}
              onCheckedChange={(checked) => setArchiveChildren(checked)}
            />
            {childCount === 1
              ? "Also archive its child session"
              : `Also archive its ${childCount} child sessions`}
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void handleConfirm()}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
