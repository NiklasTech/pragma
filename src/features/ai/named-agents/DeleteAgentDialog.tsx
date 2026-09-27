"use client";

import { useEffect, useState } from "react";
import { Warning } from "@phosphor-icons/react";

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

import type { Agent } from "./types";

interface DeleteAgentDialogProps {
  agent: Agent;
  chatCount: number;
  childCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (archiveChildren: boolean) => void;
}

export function DeleteAgentDialog({
  agent,
  chatCount,
  childCount,
  open,
  onOpenChange,
  onConfirm,
}: DeleteAgentDialogProps) {
  const [archiveChildren, setArchiveChildren] = useState(true);

  useEffect(() => {
    if (open) setArchiveChildren(true);
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Warning size={20} className="text-status-warning" />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete {agent.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {`This agent has ${chatCount} ${chatCount === 1 ? "chat" : "chats"}. Confirming archives them. Files the chats wrote are kept.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {childCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-ui-sm text-fg-muted select-none">
            <Checkbox
              checked={archiveChildren}
              onCheckedChange={(checked) => setArchiveChildren(checked)}
            />
            {childCount === 1
              ? "Also archive the child session its chats started"
              : `Also archive the ${childCount} child sessions its chats started`}
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => onConfirm(archiveChildren)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
