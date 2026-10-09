"use client";

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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

import { importableIssues, issueToTask, type GhIssue } from "./githubImport";
import { useTasksStore } from "./store";

interface ImportIssuesDialogProps {
  open: boolean;
  rootPath: string;
  onOpenChange: (open: boolean) => void;
}

export function ImportIssuesDialog({ open, rootPath, onOpenChange }: ImportIssuesDialogProps) {
  const tasks = useTasksStore((state) => state.tasks);
  const addTasks = useTasksStore((state) => state.addTasks);
  const [issues, setIssues] = useState<GhIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<number>>(() => new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIssues(null);
    setError(null);
    setPicked(new Set());
    invoke<GhIssue[]>("gh_issue_list", { repoPath: rootPath })
      .then((result) => {
        if (!cancelled) setIssues(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, rootPath]);

  const available = useMemo(() => importableIssues(issues ?? [], tasks), [issues, tasks]);

  const toggle = (issueNumber: number, checked: boolean) => {
    setPicked((current) => {
      const next = new Set(current);
      if (checked) next.add(issueNumber);
      else next.delete(issueNumber);
      return next;
    });
  };

  const handleImport = async () => {
    const now = Date.now();
    const imported = available
      .filter((issue) => picked.has(issue.number))
      .map((issue) => issueToTask(issue, now));
    setImporting(true);
    try {
      await addTasks(imported);
      toast.success(`Imported ${imported.length} issue${imported.length === 1 ? "" : "s"}`);
      onOpenChange(false);
    } catch {
      toast.error("Could not import the issues");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-ui-md">Import GitHub issues</DialogTitle>
          <DialogDescription>
            Open issues become Todo tasks that link back to the issue.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-ui-xs text-status-error">
            {error}
          </p>
        ) : issues === null ? (
          <p className="py-6 text-center text-ui-xs text-fg-subtle">Loading issues...</p>
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-ui-xs text-fg-subtle">
            {issues.length === 0 ? "No open issues." : "Every open issue is already a task."}
          </p>
        ) : (
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {available.map((issue) => (
              <label
                key={issue.url}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover"
              >
                <Checkbox
                  checked={picked.has(issue.number)}
                  onCheckedChange={(checked) => toggle(issue.number, checked)}
                  className="mt-0.5"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-ui-sm text-fg-default">
                    <span className="text-fg-subtle tabular-nums">#{issue.number}</span>{" "}
                    {issue.title}
                  </span>
                  {issue.labels.length > 0 && (
                    <span className="truncate text-ui-2xs text-fg-subtle">
                      {issue.labels.join(", ")}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          {available.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto"
              onClick={() =>
                setPicked(
                  picked.size === available.length
                    ? new Set()
                    : new Set(available.map((issue) => issue.number)),
                )
              }
            >
              {picked.size === available.length ? "Select none" : "Select all"}
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={picked.size === 0 || importing}
            onClick={() => void handleImport()}
          >
            Import {picked.size > 0 ? picked.size : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
