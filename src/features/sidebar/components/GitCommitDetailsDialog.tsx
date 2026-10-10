"use client";

import * as React from "react";
import { Copy, Check, Spinner, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Separator } from "@/shared/components/ui/separator";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { openGitDiffInSplit } from "../lib/gitDiffSplit";
import { cn } from "@/shared/lib/utils";
import { useGitStore, type GitCommitDetails, type GitCommitFileChange } from "@/shared/stores/git";

interface GitCommitDetailsDialogProps {
  sha: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FileChangeRow({
  file,
  loading,
  onClick,
}: {
  file: GitCommitFileChange;
  loading: boolean;
  onClick: () => void;
}) {
  const slashIndex = file.path.lastIndexOf("/");
  const directory = slashIndex >= 0 ? file.path.slice(0, slashIndex + 1) : "";
  const fileName = slashIndex >= 0 ? file.path.slice(slashIndex + 1) : file.path;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-ui-xs transition-colors hover:bg-bg-hover disabled:opacity-60"
    >
      <span
        className={cn(
          "w-5 shrink-0 text-center font-mono",
          file.status === "A"
            ? "text-status-success"
            : file.status === "D"
              ? "text-status-error"
              : file.status === "R" || file.status === "C"
                ? "text-status-info"
                : "text-fg-muted",
        )}
        title={file.status_label}
      >
        {file.status}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate">
          {directory && <span className="text-fg-subtle">{directory}</span>}
          <span className="text-fg-default">{fileName}</span>
        </span>
        {file.original_path && (
          <span className="flex min-w-0 shrink items-center gap-1 text-fg-subtle">
            <ArrowLeft size={12} className="shrink-0" />
            <span className="truncate">{file.original_path}</span>
          </span>
        )}
      </div>
      {loading ? (
        <Spinner size={12} className="shrink-0 animate-spin text-fg-muted" />
      ) : !file.is_binary && (file.added > 0 || file.removed > 0) ? (
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
  const [loadingDiffPath, setLoadingDiffPath] = React.useState<string | null>(null);
  const loadCommitDetails = useGitStore((s) => s.loadCommitDetails);
  const loadCommitFileDiff = useGitStore((s) => s.loadCommitFileDiff);
  const editorPanelId = useEditorPanelId();

  React.useEffect(() => {
    if (!open || !sha) {
      setDetails(null);
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
      if (!details || loadingDiffPath) return;
      setLoadingDiffPath(file.path);
      try {
        const result = await loadCommitFileDiff(details.sha, file.path, file.original_path);
        if (!result) return;
        if (result.is_binary) {
          toast.info("Binary file, no diff available");
          return;
        }
        const fileName = file.path.split("/").pop() ?? file.path;
        openGitDiffInSplit(editorPanelId, {
          id: `diff:${details.sha}:${file.path}`,
          name: `${fileName} (${details.short_sha})`,
          path: file.path,
          original: result.original_content,
          modified: result.modified_content,
          patchText: result.fallback_patch,
          staged: false,
        });
        onOpenChange(false);
      } finally {
        setLoadingDiffPath(null);
      }
    },
    [details, loadingDiffPath, loadCommitFileDiff, editorPanelId, onOpenChange],
  );

  const handleCopySha = async () => {
    if (!details) return;
    await navigator.clipboard.writeText(details.sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {loading && (
          <div className="flex min-h-[220px] flex-1 items-center justify-center gap-2 px-5 py-8 text-ui-xs text-fg-muted">
            <Spinner size={16} className="animate-spin" />
            Loading commit details…
          </div>
        )}

        {!loading && !details && (
          <div className="flex min-h-[220px] flex-1 items-center justify-center px-5 py-8 text-ui-xs text-fg-muted">
            Could not load commit details.
          </div>
        )}

        {!loading && details && (
          <>
            <DialogHeader className="shrink-0 px-5 pt-5">
              <DialogTitle className="line-clamp-2 text-ui-base">{details.subject}</DialogTitle>
              {details.body && (
                <p className="max-h-[120px] overflow-y-auto whitespace-pre-wrap text-ui-xs text-fg-muted">
                  {details.body}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-xs text-fg-muted">
                <span className="text-fg-default" title={details.author_email}>
                  {details.author}
                </span>
                <span>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(details.timestamp_secs * 1000))}
                </span>
                <span className="flex items-center gap-1">
                  <code className="rounded bg-bg-hover px-1.5 py-0.5 font-mono text-ui-xs text-fg-default">
                    {details.short_sha}
                  </code>
                  <Button variant="ghost" size="icon-xs" onClick={handleCopySha} title="Copy SHA">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                </span>
                {details.parents.map((parent) => (
                  <code
                    key={parent}
                    title={parent}
                    className="rounded bg-bg-hover px-1.5 py-0.5 font-mono text-ui-xs text-fg-default"
                  >
                    {parent.slice(0, 7)}
                  </code>
                ))}
              </div>
            </DialogHeader>

            <Separator className="my-3" />

            <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
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
                      loading={loadingDiffPath === file.path}
                      onClick={() => void handleViewDiff(file)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
