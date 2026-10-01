"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Warning } from "@phosphor-icons/react";
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

interface DeleteThreadDialogProps {
  sessions: ChatSession[];
  rootPath: string;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteThreadDialog({
  sessions,
  rootPath,
  onOpenChange,
  onDeleted,
}: DeleteThreadDialogProps) {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const deleteSession = useAIStore((state) => state.deleteSession);
  const [archiveChildren, setArchiveChildren] = useState(true);

  const sessionIds = useMemo(() => sessions.map((session) => session.id), [sessions]);
  const childCount = useMemo(
    () => outsideChildren(chatSessions, sessionIds).length,
    [chatSessions, sessionIds],
  );
  const isOpen = sessions.length > 0;
  const isBulk = sessions.length > 1;

  useEffect(() => {
    if (isOpen) setArchiveChildren(true);
  }, [isOpen]);

  const handleConfirm = useCallback(async () => {
    if (sessionIds.length === 0) return;
    try {
      if (childCount > 0) await releaseChildren(rootPath, sessionIds, archiveChildren);
      for (const sessionId of sessionIds) {
        stopSession(rootPath, sessionId);
        await deleteSession(rootPath, sessionId);
      }
      onOpenChange(false);
      onDeleted?.();
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
    rootPath,
    sessionIds,
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
