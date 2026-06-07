import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useGitStore, type GitStatusEntry, type CheckState, type GitCommit } from "@/stores/git";
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
  ClockCounterClockwise,
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

function formatRelativeTime(timestampSecs: number): string {
  const now = Date.now();
  const then = timestampSecs * 1000;
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(then).toLocaleDateString();
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

// ─── Virtualized Row Types ───────────────────────────────────────────────────

type GitRow =
  | { kind: "branch-header"; key: string }
  | { kind: "commit-area"; key: string }
  | { kind: "list-header"; key: string; count: number }
  | { kind: "file-entry"; key: string; entry: GitStatusEntry }
  | { kind: "clean-hint"; key: string }
  | { kind: "history-header"; key: string }
  | { kind: "history-entry"; key: string; commit: GitCommit };

const ROW_HEIGHTS = {
  "branch-header": 40,
  "commit-area": 176,
  "list-header": 28,
  "file-entry": 30,
  "clean-hint": 120,
  "history-header": 28,
  "history-entry": 44,
} as const;

// ─── Sub-components ──────────────────────────────────────────────────────────

function BranchHeader({
  repoLabel,
  ahead,
  behind,
  isDetached,
}: {
  repoLabel: string;
  ahead: number;
  behind: number;
  isDetached: boolean;
}) {
  return (
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
  );
}

function CommitArea({
  commitMessage,
  setCommitMessage,
  handleKeyDown,
  canCommit,
  stagedCount,
  actionBusy,
  onCommit,
}: {
  commitMessage: string;
  setCommitMessage: (v: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  canCommit: boolean;
  stagedCount: number;
  actionBusy: string | null;
  onCommit: () => void;
}) {
  return (
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
          onKeyDown={handleKeyDown}
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
        onClick={onCommit}
      >
        {actionBusy === "commit" ? "Committing…" : "Commit"}
      </Button>
    </div>
  );
}

function ListHeader({
  count,
  headerCheckState,
  actionBusy,
  onToggleAll,
}: {
  count: number;
  headerCheckState: CheckState;
  actionBusy: string | null;
  onToggleAll: () => void;
}) {
  return (
    <div className="flex h-7 items-center gap-2 px-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85">
        Changes
      </span>
      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border/60 px-1 text-[9.5px] font-semibold text-muted-foreground">
        {count}
      </span>
      <label className="ml-auto flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-[10.5px] font-medium text-muted-foreground hover:text-foreground">
        <span>All</span>
        <Checkbox
          checked={headerCheckState === "checked"}
          disabled={actionBusy !== null}
          onCheckedChange={() => onToggleAll()}
          className="size-3.5"
          data-indeterminate={headerCheckState === "indeterminate" || undefined}
        />
      </label>
    </div>
  );
}

function FileEntryRow({
  entry,
  isSelected,
  actionBusy,
  onToggleFile,
  onSelectFile,
}: {
  entry: GitStatusEntry;
  isSelected: boolean;
  actionBusy: string | null;
  onToggleFile: (entry: GitStatusEntry) => void;
  onSelectFile: (entry: GitStatusEntry) => void;
}) {
  const checkState = computeCheckState(entry);
  const fileName = basename(entry.path);
  const dir = dirname(entry.path);

  return (
    <div
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
        onCheckedChange={() => onToggleFile(entry)}
        className="size-3.5"
        data-indeterminate={checkState === "indeterminate" || undefined}
      />
      <button
        type="button"
        onClick={() => onSelectFile(entry)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <StatusIcon status={entry.status} />
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none">
          <span className="truncate text-[12px] leading-tight">{fileName}</span>
          {dir && <span className="truncate text-[10px] text-muted-foreground/70">{dir}</span>}
        </div>
      </button>
    </div>
  );
}

function CleanTreeHint({ repoLabel }: { repoLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
      <div className="flex size-8 items-center justify-center rounded-full border border-border/55 text-muted-foreground">
        <CheckCircle size={16} />
      </div>
      <div className="text-[12px] font-medium text-foreground">Working tree clean</div>
      <div className="text-[10.5px] text-muted-foreground">
        on <span className="font-mono text-foreground/80">{repoLabel}</span>
      </div>
    </div>
  );
}

function HistoryHeader() {
  return (
    <div className="flex h-7 items-center gap-1.5 px-3">
      <ClockCounterClockwise size={11} className="text-muted-foreground" />
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/85">
        Recent Commits
      </span>
    </div>
  );
}

function HistoryEntry({ commit }: { commit: GitCommit }) {
  return (
    <div
      className="group flex flex-col gap-0.5 px-3 py-1.5 hover:bg-accent/30 rounded-md mx-1"
      title={commit.message}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0">
          {shortSha(commit.id)}
        </span>
        <span className="truncate text-[11.5px] text-foreground/90">
          {commit.message.split("\n")[0]}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
        <span className="truncate">{commit.author}</span>
        <span>·</span>
        <span>{formatRelativeTime(commit.time)}</span>
      </div>
    </div>
  );
}

function RowRenderer({
  row,
  isSelected,
  actionBusy,
  repoLabel,
  onToggleFile,
  onSelectFile,
}: {
  row: GitRow;
  isSelected: (path: string) => boolean;
  actionBusy: string | null;
  repoLabel: string;
  onToggleFile: (entry: GitStatusEntry) => void;
  onSelectFile: (entry: GitStatusEntry) => void;
}) {
  switch (row.kind) {
    case "branch-header":
      return <BranchHeader repoLabel={repoLabel} ahead={0} behind={0} isDetached={false} />;
    case "commit-area":
      return null; // rendered outside virtualizer
    case "list-header":
      return (
        <ListHeader
          count={row.count}
          headerCheckState="unchecked"
          actionBusy={actionBusy}
          onToggleAll={() => {}}
        />
      );
    case "file-entry":
      return (
        <FileEntryRow
          entry={row.entry}
          isSelected={isSelected(row.entry.path)}
          actionBusy={actionBusy}
          onToggleFile={onToggleFile}
          onSelectFile={onSelectFile}
        />
      );
    case "clean-hint":
      return <CleanTreeHint repoLabel={repoLabel} />;
    case "history-header":
      return <HistoryHeader />;
    case "history-entry":
      return <HistoryEntry commit={row.commit} />;
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

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
    commits,
    loadStatus,
    loadLog,
    stageFiles,
    unstageFiles,
    commit,
    loadFileDiff,
    clearDiff,
    setCommitMessage,
  } = useGitStore();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (repoPath && !snapshot && !isLoading) {
      void loadStatus();
    }
  }, [repoPath, snapshot, isLoading, loadStatus]);

  useEffect(() => {
    if (repoPath) {
      void loadLog(5);
    }
  }, [repoPath, loadLog]);

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

  const handleCommit = () => {
    if (!canCommit) return;
    void commit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCommit();
    }
  };

  const repoLabel = snapshot?.repo.branch ?? "Source Control";
  const isDetached = snapshot?.repo.is_detached ?? false;
  const ahead = snapshot?.ahead ?? 0;
  const behind = snapshot?.behind ?? 0;

  // Build virtual rows
  const rows = useMemo<GitRow[]>(() => {
    const result: GitRow[] = [];
    result.push({ kind: "branch-header", key: "branch-header" });
    result.push({ kind: "commit-area", key: "commit-area" });

    if (files.length > 0) {
      result.push({ kind: "list-header", key: "list-header", count: files.length });
      for (const entry of files) {
        result.push({ kind: "file-entry", key: entry.path, entry });
      }
    } else {
      result.push({ kind: "clean-hint", key: "clean-hint" });
    }

    if (commits.length > 0) {
      result.push({ kind: "history-header", key: "history-header" });
      for (const c of commits) {
        result.push({ kind: "history-entry", key: `commit-${c.id}`, commit: c });
      }
    }

    return result;
  }, [files, commits]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = rows[index];
      if (!row) return ROW_HEIGHTS["file-entry"];
      return ROW_HEIGHTS[row.kind];
    },
    overscan: 8,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  const isSelected = (path: string) => selectedPath === path;

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
    <div className="flex h-full min-w-0 flex-col">
      {/* Scrollable content area — virtualized */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
            width: "100%",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;

            // Commit area is rendered outside virtualizer (has its own state)
            if (row.kind === "commit-area") {
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <CommitArea
                    commitMessage={commitMessage}
                    setCommitMessage={setCommitMessage}
                    handleKeyDown={handleKeyDown}
                    canCommit={canCommit}
                    stagedCount={stagedCount}
                    actionBusy={actionBusy}
                    onCommit={handleCommit}
                  />
                </div>
              );
            }

            // Branch header needs dynamic data
            if (row.kind === "branch-header") {
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <BranchHeader
                    repoLabel={repoLabel}
                    ahead={ahead}
                    behind={behind}
                    isDetached={isDetached}
                  />
                </div>
              );
            }

            // List header needs dynamic data
            if (row.kind === "list-header") {
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ListHeader
                    count={row.count}
                    headerCheckState={headerCheckState}
                    actionBusy={actionBusy}
                    onToggleAll={handleToggleAll}
                  />
                </div>
              );
            }

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <RowRenderer
                  row={row}
                  isSelected={isSelected}
                  actionBusy={actionBusy}
                  repoLabel={repoLabel}
                  onToggleFile={handleToggleFile}
                  onSelectFile={handleSelectFile}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Diff Panel */}
      {diffContent && diffPath && (
        <div
          className="border-t border-border/60 bg-card shrink-0 flex flex-col min-w-0 overflow-x-hidden"
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
