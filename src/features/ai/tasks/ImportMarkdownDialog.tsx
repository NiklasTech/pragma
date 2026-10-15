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
import type { DirEntry } from "@/shared/hooks/useFileExplorer";
import { relativePath } from "@/features/ai/context/autoContext";

import { importableMarkdownPaths, isMarkdownPath, markdownToTask } from "./markdownImport";
import { useRepositoryTasks, useTasksStore } from "./store";

interface FileReadResult {
  content: string;
}

interface ImportMarkdownDialogProps {
  open: boolean;
  rootPath: string;
  onOpenChange: (open: boolean) => void;
}

export function ImportMarkdownDialog({ open, rootPath, onOpenChange }: ImportMarkdownDialogProps) {
  const { tasks } = useRepositoryTasks(rootPath);
  const addTasks = useTasksStore((state) => state.addTasks);
  const [paths, setPaths] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPaths(null);
    setError(null);
    setPicked(new Set());
    invoke<DirEntry[]>("list_directory_recursive", { path: rootPath })
      .then((entries) => {
        if (cancelled) return;
        const files = entries
          .filter((entry) => entry.is_file && isMarkdownPath(entry.name))
          .map((entry) => relativePath(rootPath, entry.path))
          .sort((a, b) => a.localeCompare(b));
        setPaths(files);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, rootPath]);

  const available = useMemo(() => importableMarkdownPaths(paths ?? [], tasks), [paths, tasks]);

  const toggle = (path: string, checked: boolean) => {
    setPicked((current) => {
      const next = new Set(current);
      if (checked) next.add(path);
      else next.delete(path);
      return next;
    });
  };

  const handleImport = async () => {
    const now = Date.now();
    const root = rootPath.replace(/[\\/]+$/, "");
    setImporting(true);
    try {
      const files = await Promise.all(
        available
          .filter((path) => picked.has(path))
          .map(async (path) => {
            const file = await invoke<FileReadResult>("read_text_file", {
              path: `${root}/${path}`,
            });
            return { path, content: file.content };
          }),
      );
      const imported = files.map((file) => markdownToTask(file, now));
      await addTasks(rootPath, imported);
      toast.success(`Imported ${imported.length} file${imported.length === 1 ? "" : "s"}`);
      onOpenChange(false);
    } catch {
      toast.error("Could not import the Markdown files");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-ui-md">Import Markdown files</DialogTitle>
          <DialogDescription>
            Each file becomes a Todo task titled after its first heading.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-ui-xs text-status-error">
            {error}
          </p>
        ) : paths === null ? (
          <p className="py-6 text-center text-ui-xs text-fg-subtle">Loading files...</p>
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-ui-xs text-fg-subtle">
            {paths.length === 0
              ? "No Markdown files in this workspace."
              : "Every Markdown file is already a task."}
          </p>
        ) : (
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {available.map((path) => (
              <label
                key={path}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-bg-hover"
              >
                <Checkbox
                  checked={picked.has(path)}
                  onCheckedChange={(checked) => toggle(path, checked)}
                />
                <span className="truncate text-ui-sm text-fg-default">{path}</span>
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
                setPicked(picked.size === available.length ? new Set() : new Set(available))
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
