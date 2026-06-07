import { useEffect, useMemo, useState } from "react";
import { useGitStore, type GitStatusEntry, type CheckState } from "@/stores/git";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { GitDiffPane } from "./GitDiffPane";
import {
  Spinner,
  PencilSimple,
  Plus,
  Trash,
  ArrowsLeftRight,
  File,
  CheckCircle,
  GitBranch,
  ArrowUp,
  ArrowDown,
  X,
} from "@phosphor-icons/react";

function StatusIcon({ status }: { status: string }) {
  const props = { size: 13, className: "shrink-0" };
  switch (status) {
    case "modified":
      return <PencilSimple {...props} className="shrink-0 text-amber-400" />;
    case "new":
      return <Plus {...props} className="shrink-0 text-emerald-400" />;
    case "deleted":
      return <Trash {...props} className="shrink-0 text-rose-400" />;
    case "renamed":
      return <ArrowsLeftRight {...props} className="shrink-0 text-sky-400" />;
    default:
      return <File {...props} className="shrink-0 text-muted-foreground" />;
  }
}

function statusAccent(code: string): string {
  switch (code) {
    case "A":
      return "bg-emerald-500/80";
    case "M":
      return "bg-amber-500/80";
    case "D":
      return "bg-rose-500/80";
    case "R":
      return "bg-sky-500/80";
    default:
      return "bg-muted-foreground/40";
  }
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return "";
  return normalized.slice(0, index);
}

function computeCheckState(entry: GitStatusEntry): CheckState {
  if (entry.is_staged && entry.is_unstaged) return "indeterminate";
  if (entry.is_staged) return "checked";
  return "unchecked";
}

export function GitStatus() {
  const {
    snapshot,
    repoPath,
    isLoading,
    error,
    diffContent,
    diffPath,
    commitMessage,
    actionBusy,
    loadStatus,
    stageFiles,
    unstageFiles,
    commit,
    loadFileDiff,
    clearDiff,
    setCommitMessage,
  } = useGitStore();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (repoPath && !snapshot && !isLoading) {
      void loadStatus();
    }
  }, [repoPath, snapshot, isLoading, loadStatus]);

  const files = useMemo(() => snapshot?.changed_files ?? [], [snapshot]);

  const headerCheckState = useMemo<CheckState>(() => {
    if (files.length === 0) return "unchecked";
    const allChecked = files.every((e) => e.is_staged && !e.is_unstaged);
    if (allChecked) return "checked";
    const anyStaged = files.some((e) => e.is_staged);
    return anyStaged ? "indeterminate" : "unchecked";
  }, [files]);

  const stagedCount = useMemo(() => files.filter((f) => f.is_staged).length, [files]);

  const canCommit = stagedCount > 0 && commitMessage.trim().length > 0 && !actionBusy;

  const handleToggleAll = () => {
    if (headerCheckState === "checked") {
      const stagedPaths = files.filter((f) => f.is_staged).map((f) => f.path);
      if (stagedPaths.length > 0) void unstageFiles(stagedPaths);
    } else {
      const unstagedPaths = files.filter((f) => f.is_unstaged).map((f) => f.path);
      if (unstagedPaths.length > 0) void stageFiles(unstagedPaths);
    }
  };

  const handleToggleFile = (entry: GitStatusEntry) => {
    if (entry.is_staged && !entry.is_unstaged) {
      void unstageFiles([entry.path]);
    } else {
      void stageFiles([entry.path]);
    }
  };

  const handleSelectFile = (entry: GitStatusEntry) => {
    setSelectedPath(entry.path);
    const mode = entry.is_unstaged ? false : true;
    void loadFileDiff(entry.path, mode);
  };

  const repoLabel = snapshot?.repo.branch ?? "Source Control";
  const isDetached = snapshot?.repo.is_detached ?? false;
  const ahead = snapshot?.ahead ?? 0;
  const behind = snapshot?.behind ?? 0;

  if (!repoPath) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Open a folder to view Git status</p>
      </div>
    );
  }

  if (isLoading && !snapshot) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 min-h-0">
        {/* Branch Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1 text-[11px] font-medium">
            <GitBranch size={11} className="text-muted-foreground" />
            <span className="truncate max-w-[120px]">{repoLabel}</span>
          </div>
          {ahead > 0 || behind > 0 ? (
            <div className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
              {ahead > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1 py-px">
                  <ArrowUp size={8} weight="bold" />
                  {ahead}
                </span>
              )}
              {behind > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1 py-px">
                  <ArrowDown size={8} weight="bold" />
                  {behind}
                </span>
              )}
            </div>
          ) : null}
          {isDetached && (
            <span className="rounded bg-muted/55 px-1.5 py-px text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              detached
            </span>
          )}
        </div>

        {/* Commit Area */}
        <div className="px-2.5 pb-2.5 pt-2.5 space-y-2 border-b border-border/40">
          <div
            className={cn(
              "relative rounded-lg border bg-background/95 shadow-sm transition-colors",
              commitMessage.length > 0 ? "border-border/70" : "border-border/45",
              "focus-within:border-primary/45 focus-within:shadow-md focus-within:shadow-primary/5",
            )}
          >
            <Textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message"
              rows={2}
              className="min-h-[56px] border-0 resize-none rounded-lg bg-transparent px-3 pb-5 pt-2 text-[12px] leading-snug shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0"
            />
            <div className="pointer-events-none absolute inset-x-3 bottom-1 flex items-center text-[10px] text-muted-foreground/55">
              {commitMessage.length > 0 ? (
                <span>Ch: {commitMessage.length}</span>
              ) : (
                <span>Ctrl+Enter to commit</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                canCommit
                  ? "bg-foreground/80"
                  : stagedCount > 0
                    ? "bg-muted-foreground/60"
                    : "bg-muted-foreground/30",
              )}
            />
            <span className="truncate font-medium text-foreground/85">
              {stagedCount === 0
                ? "Nothing staged"
                : `${stagedCount} ${stagedCount === 1 ? "file" : "files"} staged`}
            </span>
          </div>

          <Button
            size="sm"
            className="h-7 w-full text-[11.5px] font-semibold"
            disabled={!canCommit}
            onClick={() => void commit()}
          >
            {actionBusy === "commit" ? "Committing…" : "Commit"}
          </Button>
        </div>

        {/* File List */}
        {files.length > 0 ? (
          <div className="py-1">
            {/* List Header */}
            <div className="flex h-7 items-center gap-2 px-3">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85">
                Changes
              </span>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border/60 px-1 text-[9.5px] font-semibold text-muted-foreground">
                {files.length}
              </span>
              <label className="ml-auto flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground hover:text-foreground">
                <span>All</span>
                <Checkbox
                  checked={headerCheckState === "checked"}
                  disabled={actionBusy !== null}
                  onCheckedChange={() => handleToggleAll()}
                  className="size-3.5"
                  data-indeterminate={headerCheckState === "indeterminate" || undefined}
                />
              </label>
            </div>

            {/* File Rows */}
            {files.map((entry) => {
              const isSelected = selectedPath === entry.path;
              const checkState = computeCheckState(entry);
              const fileName = basename(entry.path);
              const dir = dirname(entry.path);

              return (
                <div
                  key={entry.path}
                  className={cn(
                    "group relative flex h-[30px] items-center gap-2 rounded-md pl-2 pr-2 transition-all duration-100",
                    isSelected ? "bg-accent/55 text-foreground" : "hover:bg-accent/30",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-full transition-opacity",
                      statusAccent(entry.status_code),
                      isSelected ? "opacity-100" : "opacity-55 group-hover:opacity-95",
                    )}
                  />
                  <Checkbox
                    checked={checkState === "checked"}
                    disabled={actionBusy !== null}
                    onCheckedChange={() => handleToggleFile(entry)}
                    className="size-3.5"
                    data-indeterminate={checkState === "indeterminate" || undefined}
                  />
                  <button
                    type="button"
                    onClick={() => handleSelectFile(entry)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <StatusIcon status={entry.status} />
                    <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none">
                      <span className="truncate text-[12px] leading-tight">{fileName}</span>
                      {dir && (
                        <span className="truncate text-[10px] text-muted-foreground/70">{dir}</span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
            <div className="flex size-8 items-center justify-center rounded-full border border-border/55 text-muted-foreground">
              <CheckCircle size={16} />
            </div>
            <div className="text-[12px] font-medium text-foreground">Working tree clean</div>
            <div className="text-[10.5px] text-muted-foreground">
              on <span className="font-mono text-foreground/80">{repoLabel}</span>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Diff Panel */}
      {diffContent && diffPath && (
        <div
          className="border-t border-border/60 bg-card shrink-0 flex flex-col"
          style={{ maxHeight: "45%", height: "280px" }}
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 shrink-0">
            <span className="text-[10px] font-mono text-muted-foreground truncate">{diffPath}</span>
            <button
              type="button"
              onClick={clearDiff}
              className="p-1 rounded hover:bg-accent text-muted-foreground"
            >
              <X size={12} />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <GitDiffPane diffText={diffContent} filePath={diffPath} active={true} />
          </div>
        </div>
      )}
    </div>
  );
}
