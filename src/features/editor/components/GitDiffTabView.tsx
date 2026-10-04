import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Columns, Rows } from "@phosphor-icons/react";
import type { DiffTab } from "@/shared/stores/editor";
import {
  useGitStore,
  type GitDiffContentResult,
  type GitLineAction,
  type GitLineSelection,
} from "@/shared/stores/git";
import { useTheme } from "@/theme";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { SplitDiffView, type DiffViewMode } from "./InlineDiff";
import { GitHunkDiffView } from "./GitHunkDiffView";

interface DiffContent {
  original: string;
  modified: string;
  patch: string;
}

/** A working tree diff tab that reloads with the git status and acts on hunks and lines. */
export function GitDiffTabView({ tab, repoPath }: { tab: DiffTab; repoPath: string }) {
  const { resolvedMode } = useTheme();
  const snapshot = useGitStore((s) => s.snapshot);
  const busy = useGitStore((s) => s.actionBusy !== null);
  const applyLines = useGitStore((s) => s.applyLines);
  const [viewMode, setViewMode] = useState<DiffViewMode>("unified");
  const [content, setContent] = useState<DiffContent>({
    original: tab.original,
    modified: tab.modified,
    patch: tab.patchText,
  });

  useEffect(() => {
    let cancelled = false;
    invoke<GitDiffContentResult>("git_diff_content", {
      repoPath,
      path: tab.path,
      staged: tab.staged,
      originalPath: null,
    })
      .then((result) => {
        if (cancelled) return;
        setContent({
          original: result.original_content,
          modified: result.modified_content,
          patch: result.fallback_patch,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [repoPath, tab.path, tab.staged, snapshot]);

  const handleApply = useCallback(
    (action: GitLineAction, selection: GitLineSelection) => {
      void applyLines(tab.path, action, selection);
    },
    [applyLines, tab.path],
  );

  const canShowSplit = content.original.length > 0 && content.modified.length > 0;
  const showSplit = viewMode === "split" && canShowSplit;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-3">
        <span className="truncate font-mono text-ui-xs text-fg-muted" title={tab.path}>
          {tab.path}
          {tab.staged ? " (staged)" : ""}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-6 gap-1 px-2 text-ui-xs", showSplit && "bg-bg-active text-fg-default")}
            onClick={() => setViewMode("split")}
            disabled={!canShowSplit}
          >
            <Columns size={12} />
            Split
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 gap-1 px-2 text-ui-xs",
              !showSplit && "bg-bg-active text-fg-default",
            )}
            onClick={() => setViewMode("unified")}
          >
            <Rows size={12} />
            Hunks
          </Button>
        </div>
      </div>
      <div className={cn("min-h-0 flex-1", showSplit ? "overflow-auto" : "overflow-hidden")}>
        {showSplit ? (
          <SplitDiffView
            original={content.original}
            modified={content.modified}
            filePath={tab.path}
            theme={resolvedMode}
          />
        ) : (
          <GitHunkDiffView
            patchText={content.patch}
            staged={tab.staged}
            busy={busy}
            onApply={handleApply}
          />
        )}
      </div>
    </div>
  );
}
