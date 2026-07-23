"use client";

import * as React from "react";
import { Copy, Check, Spinner } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/shared/components/ui/drawer";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { InlineDiff } from "@/features/editor/components/InlineDiff";
import { cn } from "@/shared/lib/utils";
import {
  useGitStore,
  type GitCommitDetails,
  type GitCommitFileChange,
  type GitDiffContentResult,
} from "@/shared/stores/git";

interface GitCommitDetailsDialogProps {
  sha: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FileChangeRow({ file, onClick }: { file: GitCommitFileChange; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-ui-xs transition-colors hover:bg-bg-hover"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "shrink-0",
            file.status === "A"
              ? "text-status-success"
              : file.status === "D"
                ? "text-status-error"
                : file.status === "R" || file.status === "C"
                  ? "text-status-info"
                  : "text-fg-muted",
          )}
        >
          {file.status_label}
        </span>
        <span className="truncate font-mono text-fg-default group-hover:text-fg-default">
          {file.path}
        </span>
        {file.original_path && (
          <span className="truncate text-fg-subtle">← {file.original_path}</span>
        )}
      </div>
      {!file.is_binary && (file.added > 0 || file.removed > 0) ? (
        <div className="flex shrink-0 gap-2 text-ui-xs tabular-nums">
          <span className="text-status-success">+{file.added}</span>
          <span className="text-status-error">-{file.removed}</span>
        </div>
      ) : file.is_binary ? (
        <span className="shrink-0 text-fg-subtle">binary</span>
      ) : null}
    </button>
  );
}

export function GitCommitDetailsDialog({ sha, open, onOpenChange }: GitCommitDetailsDialogProps) {
  const [details, setDetails] = React.useState<GitCommitDetails | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<GitCommitFileChange | null>(null);
  const [diff, setDiff] = React.useState<GitDiffContentResult | null>(null);
  const [diffLoading, setDiffLoading] = React.useState(false);
  const [diffOpen, setDiffOpen] = React.useState(false);
  const loadCommitDetails = useGitStore((s) => s.loadCommitDetails);
  const loadCommitFileDiff = useGitStore((s) => s.loadCommitFileDiff);

  React.useEffect(() => {
    if (!open || !sha) {
      setDetails(null);
      setSelectedFile(null);
      setDiff(null);
      setDiffOpen(false);
      return;
    }

    setLoading(true);
    void loadCommitDetails(sha)
      .then((result) => {
        setDetails(result);
      })
      .catch(() => {
        setDetails(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, sha, loadCommitDetails]);

  const handleViewDiff = React.useCallback(
    async (file: GitCommitFileChange) => {
      if (!details) return;
      setSelectedFile(file);
      setDiffOpen(true);
      setDiffLoading(true);
      const result = await loadCommitFileDiff(details.sha, file.path, file.original_path);
      setDiff(result);
      setDiffLoading(false);
    },
    [details, loadCommitFileDiff],
  );

  const handleCopySha = async () => {
    if (!details) return;
    await navigator.clipboard.writeText(details.sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-3 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-4 pt-4">
          <DialogTitle className="text-ui-base">Commit Details</DialogTitle>
          <DialogDescription className="text-ui-xs">
            {details ? details.short_sha : sha ? sha.slice(0, 7) : "-"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
          {loading && (
            <div className="flex flex-1 items-center justify-center gap-2 text-ui-xs text-fg-muted">
              <Spinner size={16} className="animate-spin" />
              Loading commit details…
            </div>
          )}

          {!loading && !details && (
            <div className="flex flex-1 items-center justify-center text-ui-xs text-fg-muted">
              Could not load commit details.
            </div>
          )}

          {!loading && details && (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
              {/* SHA */}
              <div className="flex items-center gap-2">
                <span className="text-ui-xs font-medium text-fg-subtle">SHA</span>
                <code className="rounded bg-bg-hover px-1.5 py-0.5 font-mono text-ui-xs text-fg-default">
                  {details.sha}
                </code>
                <Button variant="ghost" size="icon-xs" onClick={handleCopySha} title="Copy SHA">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Button>
              </div>

              {/* Author & Date */}
              <div className="grid grid-cols-2 gap-3 text-ui-xs">
                <div>
                  <span className="block text-fg-subtle">Author</span>
                  <span className="text-fg-default">{details.author}</span>
                  <span className="block text-fg-subtle">{details.author_email}</span>
                </div>
                <div>
                  <span className="block text-fg-subtle">Date</span>
                  <span className="text-fg-default">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(details.timestamp_secs * 1000))}
                  </span>
                </div>
              </div>

              {/* Parents */}
              {details.parents.length > 0 && (
                <div className="shrink-0">
                  <span className="block text-ui-xs text-fg-subtle">Parents</span>
                  <div className="flex flex-wrap gap-1.5">
                    {details.parents.map((parent) => (
                      <code
                        key={parent}
                        className="rounded bg-bg-hover px-1.5 py-0.5 font-mono text-ui-xs text-fg-default"
                      >
                        {parent.slice(0, 7)}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {/* Message */}
              <div className="flex min-h-0 shrink-0 flex-col">
                <span className="block text-ui-xs text-fg-subtle">Message</span>
                <div className="max-h-[140px] overflow-y-auto rounded bg-bg-hover p-2 text-ui-sm text-fg-default">
                  <p className="font-medium">{details.subject}</p>
                  {details.body && (
                    <pre className="mt-1 whitespace-pre-wrap font-sans text-ui-xs text-fg-muted">
                      {details.body}
                    </pre>
                  )}
                </div>
              </div>

              {/* Files */}
              <div className="flex min-h-0 flex-1 flex-col">
                <span className="mb-1 block text-ui-xs text-fg-subtle">
                  Changed files ({details.files.length})
                </span>
                <ScrollArea className="h-full min-h-[180px] rounded border border-border bg-bg-root">
                  <div className="p-1">
                    {details.files.length === 0 && (
                      <div className="px-2 py-3 text-ui-xs text-fg-muted">No files changed.</div>
                    )}
                    {details.files.map((file) => (
                      <FileChangeRow
                        key={file.path}
                        file={file}
                        onClick={() => handleViewDiff(file)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        <Drawer open={diffOpen} onOpenChange={setDiffOpen}>
          <DrawerContent side="right" className="max-w-5xl">
            <DrawerHeader>
              <DrawerTitle className="text-ui-base">Diff</DrawerTitle>
              <DrawerDescription className="truncate font-mono text-ui-xs">
                {selectedFile?.path}
              </DrawerDescription>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
              {diffLoading && (
                <div className="flex h-full items-center justify-center gap-2 text-ui-xs text-fg-muted">
                  <Spinner size={16} className="animate-spin" />
                  Loading diff…
                </div>
              )}

              {!diffLoading && !diff && (
                <div className="flex h-full items-center justify-center text-ui-xs text-fg-muted">
                  Could not load diff.
                </div>
              )}

              {!diffLoading && diff && diff.is_binary && (
                <div className="flex h-full items-center justify-center text-ui-xs text-fg-muted">
                  Binary file
                </div>
              )}

              {!diffLoading && diff && !diff.is_binary && (
                <InlineDiff
                  className="h-full"
                  filePath={selectedFile?.path ?? ""}
                  original={diff.original_content}
                  modified={diff.modified_content}
                  patchText={diff.fallback_patch || undefined}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </DialogContent>
    </Dialog>
  );
}
