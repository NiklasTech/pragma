import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Badge } from "@/shared/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { useGitStore } from "@/shared/stores/git";
import { openGitDiffInSplit } from "../lib/gitDiffSplit";
import { repoRelativePath, useFileHistoryDialog } from "../lib/gitDialogs";
import { relativeDate } from "./git-graph/format";
import type { GitLogEntry } from "./git-graph/types";

export function FileHistoryDialog() {
  const path = useFileHistoryDialog((s) => s.path);
  const close = useFileHistoryDialog((s) => s.close);
  const repoPath = useGitStore((s) => s.repoPath);
  const loadCommitFileDiff = useGitStore((s) => s.loadCommitFileDiff);
  const editorPanelId = useEditorPanelId();

  const [entries, setEntries] = useState<GitLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSha, setLoadingSha] = useState<string | null>(null);

  const relPath = path && repoPath ? repoRelativePath(repoPath, path) : null;

  useEffect(() => {
    if (!path || !repoPath) return;
    let cancelled = false;
    setEntries([]);
    setError(null);
    setLoading(true);
    invoke<GitLogEntry[]>("git_file_history", { repoPath, path })
      .then((result) => {
        if (!cancelled) setEntries(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, repoPath]);

  const handleOpen = async (entry: GitLogEntry) => {
    if (!relPath || loadingSha) return;
    setLoadingSha(entry.sha);
    try {
      const result = await loadCommitFileDiff(entry.sha, relPath);
      if (!result) return;
      if (result.is_binary) {
        toast.info("Binary file, no diff available");
        return;
      }
      const fileName = relPath.split("/").pop() ?? relPath;
      openGitDiffInSplit(editorPanelId, {
        id: `diff:${entry.sha}:${relPath}`,
        name: `${fileName} (${entry.short_sha})`,
        path: relPath,
        original: result.original_content,
        modified: result.modified_content,
        patchText: result.fallback_patch,
        staged: false,
      });
      close();
    } finally {
      setLoadingSha(null);
    }
  };

  return (
    <Dialog open={!!path} onOpenChange={(open) => !open && close()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>File History</DialogTitle>
          <DialogDescription className="truncate font-mono" title={relPath ?? undefined}>
            {relPath ?? "Open a repository to see the history of a file."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-full min-h-[220px] rounded border border-border bg-bg-root">
          <div className="p-1">
            {loading && (
              <div className="flex items-center gap-2 px-2 py-3 text-ui-xs text-fg-muted">
                <Spinner size={12} className="animate-spin" />
                Loading history…
              </div>
            )}
            {!loading && error && (
              <div className="px-2 py-3 text-ui-xs text-status-error">{error}</div>
            )}
            {!loading && !error && relPath && entries.length === 0 && (
              <div className="px-2 py-3 text-ui-xs text-fg-muted">
                No commits touched this file.
              </div>
            )}
            {entries.map((entry) => (
              <button
                key={entry.sha}
                type="button"
                onClick={() => void handleOpen(entry)}
                disabled={loadingSha !== null}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-ui-xs transition-colors hover:bg-bg-hover disabled:opacity-60"
              >
                <span className="w-14 shrink-0 font-mono text-fg-muted">{entry.short_sha}</span>
                <span className="min-w-0 flex-1 truncate text-fg-default" title={entry.subject}>
                  {entry.subject || "(no subject)"}
                </span>
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="max-w-24 truncate">
                    {tag}
                  </Badge>
                ))}
                <span className="max-w-28 shrink-0 truncate text-fg-muted">{entry.author}</span>
                {loadingSha === entry.sha ? (
                  <Spinner size={12} className="shrink-0 animate-spin text-fg-muted" />
                ) : (
                  <span className="w-16 shrink-0 text-right tabular-nums text-fg-subtle">
                    {relativeDate(entry.timestamp_secs)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
