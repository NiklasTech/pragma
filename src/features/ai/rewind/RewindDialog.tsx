"use client";

import { ClockCounterClockwise } from "@phosphor-icons/react";

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

import type { FileCheckpoint } from "./checkpoints";

interface RewindDialogProps {
  open: boolean;
  removedMessages: number;
  files: FileCheckpoint[];
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function rewindDescription(removedMessages: number, fileCount: number): string {
  const messages = `${removedMessages} later ${removedMessages === 1 ? "message is" : "messages are"} removed from this thread.`;
  if (fileCount === 0)
    return `${messages} No files the agent changed after this point can be restored.`;
  return `${messages} These files go back to their state at this point:`;
}

export function RewindDialog({
  open,
  removedMessages,
  files,
  onOpenChange,
  onConfirm,
}: RewindDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <ClockCounterClockwise size={20} className="text-status-warning" />
          </AlertDialogMedia>
          <AlertDialogTitle>Rewind to this message?</AlertDialogTitle>
          <AlertDialogDescription>
            {rewindDescription(removedMessages, files.length)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {files.length > 0 && (
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 font-mono text-ui-xs text-fg-muted">
            {files.map((file) => (
              <li key={file.path} className="truncate" title={file.path}>
                {file.before === null ? `${file.path} (deleted)` : file.path}
              </li>
            ))}
          </ul>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Rewind
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
