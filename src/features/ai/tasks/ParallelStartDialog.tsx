"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

import { MAX_PARALLEL_TASKS, backgroundStartBlocker, startTasksInBackground } from "./background";
import { useTasksStore } from "./store";

interface ParallelStartDialogProps {
  open: boolean;
  rootPath: string;
  onOpenChange: (open: boolean) => void;
}

/// Picks Todo tasks and starts each in its own worktree session that runs in the background.
export function ParallelStartDialog({ open, rootPath, onOpenChange }: ParallelStartDialogProps) {
  const tasks = useTasksStore((state) => state.tasks);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (open) setPicked(new Set());
  }, [open]);

  const candidates = useMemo(
    () =>
      tasks
        .filter((task) => task.status === "todo")
        .map((task) => ({ task, blocker: backgroundStartBlocker(task, tasks) })),
    // Reopening re-reads which runs are still live.
    [tasks, open],
  );

  const toggle = (taskId: string, checked: boolean) => {
    setPicked((current) => {
      const next = new Set(current);
      if (checked && next.size < MAX_PARALLEL_TASKS) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  };

  const handleStart = async () => {
    const selected = candidates.filter(({ task }) => picked.has(task.id)).map(({ task }) => task);
    setStarting(true);
    try {
      const { started, failures } = await startTasksInBackground(rootPath, selected);
      if (started > 0) {
        toast.success(`Started ${started} task${started === 1 ? "" : "s"} in worktrees`);
      }
      for (const failure of failures) toast.error(failure);
      onOpenChange(false);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-ui-md">Start tasks in parallel</DialogTitle>
          <DialogDescription>
            Each task gets its own worktree session and runs in the background. Pick up to{" "}
            {MAX_PARALLEL_TASKS}.
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <p className="py-6 text-center text-ui-xs text-fg-subtle">No tasks in Todo.</p>
        ) : (
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {candidates.map(({ task, blocker }) => (
              <label
                key={task.id}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover has-disabled:cursor-not-allowed has-disabled:opacity-60"
              >
                <Checkbox
                  checked={picked.has(task.id)}
                  disabled={
                    blocker !== null || (!picked.has(task.id) && picked.size >= MAX_PARALLEL_TASKS)
                  }
                  onCheckedChange={(checked) => toggle(task.id, checked)}
                  className="mt-0.5"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-ui-sm text-fg-default">{task.title}</span>
                  {blocker && (
                    <span className="truncate text-ui-2xs text-fg-subtle">{blocker}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={picked.size === 0 || starting}
            onClick={() => void handleStart()}
          >
            Start {picked.size > 0 ? picked.size : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
