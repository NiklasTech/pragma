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

import { childSessions, descendantIds } from "../children/limits";

interface DeleteThreadDialogProps {
  session: ChatSession | null;
  rootPath: string;
  onOpenChange: (open: boolean) => void;
}

async function releaseChildren(
  rootPath: string,
  parentId: string,
  archive: boolean,
): Promise<void> {
  const { chatSessions, updateChatSession } = useAIStore.getState();
  const now = Date.now();

  if (archive) {
    const ids = new Set(descendantIds(chatSessions, parentId));
    for (const child of chatSessions.filter((item) => ids.has(item.id) && !item.archived)) {
      await updateChatSession(rootPath, { ...child, archived: true, updatedAt: now });
    }
    return;
  }

  for (const child of childSessions(chatSessions, parentId)) {
    const unlinked = { ...child, updatedAt: now };
    delete unlinked.parentId;
    await updateChatSession(rootPath, unlinked);
  }
}

export function DeleteThreadDialog({ session, rootPath, onOpenChange }: DeleteThreadDialogProps) {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const deleteSession = useAIStore((state) => state.deleteSession);
  const [archiveChildren, setArchiveChildren] = useState(true);

  const sessionId = session?.id ?? null;
  const childCount = useMemo(
    () => (sessionId ? childSessions(chatSessions, sessionId).length : 0),
    [chatSessions, sessionId],
  );

  useEffect(() => {
    if (sessionId) setArchiveChildren(true);
  }, [sessionId]);

  const handleConfirm = useCallback(async () => {
    if (!sessionId) return;
    try {
      if (childCount > 0) await releaseChildren(rootPath, sessionId, archiveChildren);
      await deleteSession(rootPath, sessionId);
      onOpenChange(false);
    } catch {
      toast.error("Failed to delete thread");
    }
  }, [archiveChildren, childCount, deleteSession, onOpenChange, rootPath, sessionId]);

  return (
    <AlertDialog
      open={session !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Warning size={20} className="text-status-warning" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete thread?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{session?.title ?? ""}&quot;? This action cannot
            be undone.
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
