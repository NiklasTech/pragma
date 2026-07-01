import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useGitStore,
  type GitStatusEntry,
  type CheckState,
  type GitCommit,
  type GitBranch,
} from "@/shared/stores/git";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { parseDiffToSides } from "@/shared/lib/diff";
import { useEditorStore } from "@/shared/stores/editor";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/components/ui/context-menu";
import {
  Spinner,
  PencilSimple,
  Plus,
  Trash,
  ArrowsLeftRight,
  File,
  CheckCircle,
  ClockCounterClockwise,
  GitDiff,
  CaretDown,
  CaretRight,
  ArrowsClockwise,
  ArrowUp,
  ArrowDown,
  DownloadSimple,
  GitBranch as GitBranchIcon,
  Check,
  X,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";

function StatusIcon({ status }: { status: string }) {
  const props = { size: 13, className: "shrink-0" };
  switch (status) {
    case "modified":
      return <PencilSimple {...props} className="shrink-0 text-status-warning" />;
    case "new":
      return <Plus {...props} className="shrink-0 text-status-success" />;
    case "deleted":
      return <Trash {...props} className="shrink-0 text-status-error" />;
    case "renamed":
      return <ArrowsLeftRight {...props} className="shrink-0 text-status-info" />;
    default:
      return <File {...props} className="shrink-0 text-fg-muted" />;
  }
}

function statusAccent(code: string): string {
  switch (code) {
    case "A":
      return "bg-status-success/80";
    case "M":
      return "bg-status-warning/80";
    case "D":
      return "bg-status-error/80";
    case "R":
      return "bg-status-info/80";
    default:
      return "bg-fg-muted/40";
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

type GitRow =
  | { kind: "commit-area"; key: string }
  | { kind: "staged-header"; key: string; count: number }
  | { kind: "staged-entry"; key: string; entry: GitStatusEntry }
  | { kind: "unstaged-header"; key: string; count: number }
  | { kind: "unstaged-entry"; key: string; entry: GitStatusEntry }
  | { kind: "clean-hint"; key: string }
  | { kind: "history-header"; key: string }
  | { kind: "history-entry"; key: string; commit: GitCommit };

const ROW_HEIGHTS = {
  "commit-area": 176,
  "staged-header": 28,
  "staged-entry": 30,
  "unstaged-header": 28,
  "unstaged-entry": 30,
  "clean-hint": 120,
  "history-header": 28,
  "history-entry": 44,
} as const;

// ─── Toolbar ────────────────────────────────────────────────────────────────

function GitToolbar({
  onRefresh,
  onFetch,
  onPull,
  onPush,
  onNewBranch,
  canPushPull,
  ahead,
  behind,
  isPushBusy,
  isPullBusy,
  isFetchBusy,
  isRefreshBusy,
}: {
  onRefresh: () => void;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
  onNewBranch: () => void;
  canPushPull: boolean;
  ahead: number;
  behind: number;
  isPushBusy: boolean;
  isPullBusy: boolean;
  isFetchBusy: boolean;
  isRefreshBusy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-1 border-b border-border/40 bg-bg-surface px-2 py-1.5">
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          icon={ArrowsClockwise}
          label="Refresh"
          onClick={onRefresh}
          busy={isRefreshBusy}
        />
        <ToolbarButton icon={DownloadSimple} label="Fetch" onClick={onFetch} busy={isFetchBusy} />
        <ToolbarButton
          icon={ArrowDown}
          label="Pull"
          onClick={onPull}
          busy={isPullBusy}
          disabled={!canPushPull || behind === 0}
          badge={behind > 0 ? behind : null}
        />
        <ToolbarButton
          icon={ArrowUp}
          label="Push"
          onClick={onPush}
          busy={isPushBusy}
          disabled={!canPushPull || ahead === 0}
          badge={ahead > 0 ? ahead : null}
        />
      </div>
      <ToolbarButton icon={Plus} label="New Branch" onClick={onNewBranch} />
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  busy,
  disabled,
  badge,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  badge?: number | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={label}
      className={cn(
        "relative flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-fg-muted transition-colors",
        disabled ? "opacity-40" : "hover:bg-bg-hover hover:text-fg-default",
      )}
    >
      {busy ? <Spinner size={14} className="animate-spin" /> : <Icon size={16} />}
      {badge !== undefined && badge !== null && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-fg-inverse">
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Branch Header ──────────────────────────────────────────────────────────

function BranchHeader({
  ahead,
  behind,
  isDetached,
  branches,
  currentBranch,
  onCheckout,
  onCreateBranch,
  onDeleteBranch,
  actionBusy,
}: {
  ahead: number;
  behind: number;
  isDetached: boolean;
  branches: GitBranch[];
  currentBranch: string;
  onCheckout: (name: string) => void;
  onCreateBranch: (name: string) => void;
  onDeleteBranch: (name: string) => void;
  actionBusy: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewBranchName("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleCreate = () => {
    const name = newBranchName.trim();
    if (!name) return;
    onCreateBranch(name);
    setCreating(false);
    setNewBranchName("");
    setOpen(false);
  };

  return (
    <div
      className="relative flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2"
      ref={menuRef}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={actionBusy === "checkout"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md bg-bg-hover px-2 py-1 text-ui-sm font-medium transition-colors",
          open ? "bg-bg-active" : "hover:bg-bg-hover",
        )}
      >
        {actionBusy === "checkout" ? (
          <Spinner size={12} className="animate-spin text-fg-muted" />
        ) : (
          <GitBranchIcon size={12} className="text-fg-muted" />
        )}
        <span className="max-w-[140px] truncate">{currentBranch}</span>
        <CaretDown size={10} className="text-fg-subtle" />
        {isDetached && (
          <span className="rounded bg-bg-hover px-1 py-px text-ui-2xs font-medium uppercase tracking-wider text-fg-muted">
            detached
          </span>
        )}
      </button>

      <div className="flex items-center gap-1 text-ui-xs font-semibold text-fg-muted">
        {behind > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1.5 py-px text-status-success">
            <ArrowDown size={9} />
            {behind}
          </span>
        )}
        {ahead > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1.5 py-px text-status-info">
            <ArrowUp size={9} />
            {ahead}
          </span>
        )}
        {ahead === 0 && behind === 0 && (
          <span className="rounded border border-border/60 px-1.5 py-px text-fg-subtle">
            up to date
          </span>
        )}
      </div>

      {open && (
        <div className="absolute left-3 top-full z-50 mt-1 w-64 rounded-md border border-border/60 bg-bg-elevated shadow-lg shadow-black/10">
          <div className="max-h-72 overflow-y-auto py-1">
            {branches.map((branch) => {
              const isCurrent = branch.name === currentBranch;
              return (
                <div
                  key={branch.name}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1.5 text-ui-sm",
                    isCurrent
                      ? "bg-bg-active font-medium text-fg-default"
                      : "text-fg-default hover:bg-bg-hover",
                  )}
                >
                  <ContextMenu>
                    <ContextMenuTrigger className="flex min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isCurrent) onCheckout(branch.name);
                          setOpen(false);
                        }}
                        disabled={isCurrent}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        {isCurrent ? (
                          <Check size={12} className="shrink-0 text-primary" weight="bold" />
                        ) : (
                          <GitBranchIcon size={12} className="shrink-0 text-fg-muted" />
                        )}
                        <span className="truncate">{branch.name}</span>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-44">
                      {!isCurrent && (
                        <>
                          <ContextMenuItem onClick={() => onCheckout(branch.name)}>
                            Checkout
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => onDeleteBranch(branch.name)}
                            className="text-status-error focus:text-status-error"
                          >
                            Delete
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/60 px-2 py-1.5">
            {creating ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewBranchName("");
                    }
                  }}
                  placeholder="Branch name"
                  className="h-7 text-ui-sm"
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={handleCreate}
                  disabled={!newBranchName.trim() || actionBusy === "create-branch"}
                >
                  {actionBusy === "create-branch" ? (
                    <Spinner size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => {
                    setCreating(false);
                    setNewBranchName("");
                  }}
                >
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-ui-sm text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default"
              >
                <Plus size={12} />
                Create new branch
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Commit Area ────────────────────────────────────────────────────────────

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
    <div className="space-y-2 border-b border-border/60 px-2.5 pb-2.5 pt-2.5">
      <div
        className={cn(
          "relative rounded-lg border bg-bg-surface shadow-sm transition-colors",
          commitMessage.length > 0 ? "border-border/70" : "border-border/45",
          "focus-within:border-primary/45 focus-within:shadow-[0_0_12px_-4px_var(--color-accent-glow)]",
        )}
      >
        <Textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Commit message"
          rows={3}
          className="field-sizing-fixed max-h-[240px] min-h-[120px] resize-none overflow-y-auto rounded-lg border-0 bg-transparent px-3 pb-2 pt-2 text-ui-sm leading-snug shadow-none placeholder:text-fg-subtle focus-visible:ring-0"
        />
      </div>

      <div className="flex items-center justify-between gap-1.5 text-ui-xs text-fg-muted">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              canCommit
                ? "bg-fg-default/80"
                : stagedCount > 0
                  ? "bg-fg-muted/60"
                  : "bg-fg-subtle/60",
            )}
          />
          <span className="truncate font-medium text-fg-default/85">
            {stagedCount === 0
              ? "Nothing staged"
              : `${stagedCount} ${stagedCount === 1 ? "file" : "files"} staged`}
          </span>
          {commitMessage.length > 0 && (
            <span className="text-fg-subtle">· {commitMessage.length} chars</span>
          )}
        </div>
        <Button
          size="sm"
          className="h-7 text-ui-sm font-semibold"
          disabled={!canCommit}
          onClick={onCommit}
        >
          {actionBusy === "commit" ? "Committing…" : "Commit"}
        </Button>
      </div>
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  checkState,
  actionBusy,
  onToggleAll,
  onStageAll,
  onUnstageAll,
  mode,
}: {
  title: string;
  count: number;
  checkState: CheckState;
  actionBusy: string | null;
  onToggleAll: () => void;
  onStageAll?: () => void;
  onUnstageAll?: () => void;
  mode: "staged" | "unstaged";
}) {
  return (
    <div className="flex h-7 items-center gap-2 px-3">
      <span className="text-ui-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
        {title}
      </span>
      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-border/60 px-1 text-ui-xs font-semibold text-fg-muted">
        {count}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {mode === "unstaged" && onStageAll && count > 0 && (
          <button
            type="button"
            onClick={onStageAll}
            disabled={actionBusy !== null}
            className="text-ui-2xs font-medium text-fg-muted transition-colors hover:text-fg-default disabled:opacity-40"
          >
            Stage all
          </button>
        )}
        {mode === "staged" && onUnstageAll && count > 0 && (
          <button
            type="button"
            onClick={onUnstageAll}
            disabled={actionBusy !== null}
            className="text-ui-2xs font-medium text-fg-muted transition-colors hover:text-fg-default disabled:opacity-40"
          >
            Unstage all
          </button>
        )}
        <label className="ml-2 flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-ui-xs font-medium text-fg-muted hover:text-fg-default">
          <Checkbox
            checked={checkState === "checked"}
            disabled={actionBusy !== null || count === 0}
            onCheckedChange={() => onToggleAll()}
            className="size-3.5"
            data-indeterminate={checkState === "indeterminate" || undefined}
          />
        </label>
      </div>
    </div>
  );
}

// ─── File Row ───────────────────────────────────────────────────────────────

function FileRow({
  entry,
  isSelected,
  actionBusy,
  mode,
  onToggle,
  onSelect,
  onOpenDiff,
  onDiscard,
}: {
  entry: GitStatusEntry;
  isSelected: boolean;
  actionBusy: string | null;
  mode: "staged" | "unstaged";
  onToggle: (entry: GitStatusEntry) => void;
  onSelect: (entry: GitStatusEntry) => void;
  onOpenDiff: (entry: GitStatusEntry) => void;
  onDiscard?: (entry: GitStatusEntry) => void;
}) {
  const fileName = basename(entry.path);
  const dir = dirname(entry.path);
  const checkState =
    mode === "staged" ? (entry.is_unstaged ? "indeterminate" : "checked") : "unchecked";

  const row = (
    <div
      className={cn(
        "group relative flex h-[30px] items-center gap-2 rounded-md pl-2 pr-2 transition-all duration-100",
        isSelected ? "bg-bg-active text-fg-default" : "hover:bg-bg-hover",
      )}
      onClick={() => onSelect(entry)}
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
        onCheckedChange={() => onToggle(entry)}
        className="size-3.5"
        data-indeterminate={checkState === "indeterminate" || undefined}
        onClick={(e) => e.stopPropagation()}
      />
      <StatusIcon status={entry.status} />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none">
        <span className="truncate text-ui-sm leading-tight">{fileName}</span>
        {dir && <span className="truncate text-ui-xs text-fg-muted/70">{dir}</span>}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDiff(entry);
        }}
        className="shrink-0 rounded p-0.5 text-fg-muted opacity-0 transition-opacity hover:text-fg-default group-hover:opacity-100"
        title="Open diff in editor"
      >
        <GitDiff size={13} />
      </button>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>{row}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onToggle(entry)}>
          {mode === "staged" ? "Unstage" : "Stage"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onOpenDiff(entry)}>
          <GitDiff size={14} className="mr-2" />
          Open Diff
        </ContextMenuItem>
        <ContextMenuSeparator />
        {onDiscard && mode === "unstaged" && (
          <ContextMenuItem
            onClick={() => onDiscard(entry)}
            className="text-status-error focus:text-status-error"
          >
            <Trash size={14} className="mr-2" />
            Discard Changes
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── Clean Hint ─────────────────────────────────────────────────────────────

function CleanTreeHint({ repoLabel }: { repoLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center">
      <div className="flex size-8 items-center justify-center rounded-full border border-border/60 text-fg-muted">
        <CheckCircle size={16} />
      </div>
      <div className="text-ui-sm font-medium text-fg-default">Working tree clean</div>
      <div className="text-ui-xs text-fg-muted">
        on <span className="font-mono text-fg-default/80">{repoLabel}</span>
      </div>
    </div>
  );
}

// ─── History ────────────────────────────────────────────────────────────────

function HistoryHeader({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-7 w-full items-center gap-1.5 px-3 text-left transition-colors hover:bg-bg-hover"
    >
      {expanded ? (
        <CaretDown size={11} className="text-fg-muted" />
      ) : (
        <CaretRight size={11} className="text-fg-muted" />
      )}
      <ClockCounterClockwise size={11} className="text-fg-muted" />
      <span className="text-ui-xs font-semibold uppercase tracking-[0.14em] text-fg-muted">
        Recent Commits
      </span>
    </button>
  );
}

function HistoryEntry({ commit }: { commit: GitCommit }) {
  return (
    <div
      className="group mx-1 flex flex-col gap-0.5 rounded-md px-3 py-1.5 hover:bg-bg-hover"
      title={commit.message}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 font-mono text-ui-xs text-fg-subtle">{shortSha(commit.id)}</span>
        <span className="truncate text-ui-sm text-fg-default/90">
          {commit.message.split("\n")[0]}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-ui-xs text-fg-subtle">
        <span className="truncate">{commit.author}</span>
        <span>·</span>
        <span>{formatRelativeTime(commit.time)}</span>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function GitStatus() {
  const {
    snapshot,
    repoPath,
    isLoading,
    error,
    commitMessage,
    actionBusy,
    actionStatus,
    commits,
    branches,
    loadStatus,
    loadLog,
    loadBranches,
    stageFiles,
    unstageFiles,
    commit,
    loadFileDiff,
    setCommitMessage,
    checkoutBranch,
    createBranch,
    deleteBranch,
    push,
    pull,
    fetch,
    refreshAll,
    discardFiles,
    remotes,
  } = useGitStore();

  const { openDiff } = useEditorStore();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [discardEntry, setDiscardEntry] = useState<GitStatusEntry | null>(null);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (repoPath && !snapshot && !isLoading) {
      void loadStatus();
    }
  }, [repoPath, snapshot, isLoading, loadStatus]);

  useEffect(() => {
    if (repoPath) {
      void loadLog(8);
      void loadBranches();
    }
  }, [repoPath, loadLog, loadBranches]);

  const allFiles = useMemo(() => snapshot?.changed_files ?? [], [snapshot]);
  const stagedFiles = useMemo(() => allFiles.filter((f) => f.is_staged), [allFiles]);
  const unstagedFiles = useMemo(() => allFiles.filter((f) => f.is_unstaged), [allFiles]);

  const stagedCheckState = useMemo<CheckState>(() => {
    if (stagedFiles.length === 0) return "unchecked";
    const anyUnstagedPart = stagedFiles.some((e) => e.is_unstaged);
    return anyUnstagedPart ? "indeterminate" : "checked";
  }, [stagedFiles]);

  const unstagedCheckState = useMemo<CheckState>(() => {
    if (unstagedFiles.length === 0) return "unchecked";
    return "checked";
  }, [unstagedFiles]);

  const stagedCount = stagedFiles.length;
  const canCommit = stagedCount > 0 && commitMessage.trim().length > 0 && !actionBusy;

  const hasRemote = remotes.length > 0;
  const isDetached = snapshot?.repo.is_detached ?? false;
  const canPushPull = hasRemote && !isDetached;

  const handleStageAll = () => {
    const paths = unstagedFiles.map((f) => f.path);
    if (paths.length > 0) void stageFiles(paths);
  };

  const handleUnstageAll = () => {
    const paths = stagedFiles.map((f) => f.path);
    if (paths.length > 0) void unstageFiles(paths);
  };

  const handleToggleStaged = (entry: GitStatusEntry) => {
    if (entry.is_unstaged) {
      void unstageFiles([entry.path]);
    }
  };

  const handleToggleUnstaged = (entry: GitStatusEntry) => {
    void stageFiles([entry.path]);
  };

  const handleSelectFile = (entry: GitStatusEntry) => {
    setSelectedPath(entry.path);
  };

  const handleOpenDiff = async (entry: GitStatusEntry, staged: boolean) => {
    try {
      const content = await loadFileDiff(entry.path, staged);
      if (!content || content === "No diff available") return;

      const { original, modified } = parseDiffToSides(content);

      openDiff({
        id: `diff:${entry.path}:${staged ? "staged" : "unstaged"}`,
        path: entry.path,
        original,
        modified,
        patchText: content,
        staged,
      });
    } catch {
      // Error is handled by the store
    }
  };

  const handleDiscard = async (entry: GitStatusEntry) => {
    setDiscardEntry(null);
    void discardFiles([entry.path]);
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
  const currentBranch = snapshot?.repo.branch ?? repoLabel;
  const ahead = snapshot?.ahead ?? 0;
  const behind = snapshot?.behind ?? 0;

  const rows = useMemo<GitRow[]>(() => {
    const result: GitRow[] = [];
    result.push({ kind: "commit-area", key: "commit-area" });

    if (allFiles.length === 0) {
      result.push({ kind: "clean-hint", key: "clean-hint" });
    } else {
      if (stagedFiles.length > 0) {
        result.push({ kind: "staged-header", key: "staged-header", count: stagedFiles.length });
        for (const entry of stagedFiles) {
          result.push({ kind: "staged-entry", key: `staged-${entry.path}`, entry });
        }
      }
      if (unstagedFiles.length > 0) {
        result.push({
          kind: "unstaged-header",
          key: "unstaged-header",
          count: unstagedFiles.length,
        });
        for (const entry of unstagedFiles) {
          result.push({ kind: "unstaged-entry", key: `unstaged-${entry.path}`, entry });
        }
      }
    }

    if (commits.length > 0) {
      result.push({ kind: "history-header", key: "history-header" });
      if (historyExpanded) {
        for (const c of commits) {
          result.push({ kind: "history-entry", key: `commit-${c.id}`, commit: c });
        }
      }
    }

    return result;
  }, [allFiles, stagedFiles, unstagedFiles, commits, historyExpanded]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = rows[index];
      if (!row) return ROW_HEIGHTS["unstaged-entry"];
      return ROW_HEIGHTS[row.kind];
    },
    overscan: 8,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  const isSelected = (path: string) => selectedPath === path;

  if (!repoPath) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-ui-sm text-fg-muted">Open a folder to view Git status</p>
      </div>
    );
  }

  if (isLoading && !snapshot) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={20} className="animate-spin text-fg-muted" />
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-ui-sm text-status-error">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <GitToolbar
        onRefresh={() => void refreshAll()}
        onFetch={() => void fetch()}
        onPull={() => void pull()}
        onPush={() => void push()}
        onNewBranch={() => setCreateBranchOpen(true)}
        canPushPull={canPushPull}
        ahead={ahead}
        behind={behind}
        isPushBusy={actionBusy === "push"}
        isPullBusy={actionBusy === "pull"}
        isFetchBusy={actionBusy === "fetch"}
        isRefreshBusy={isLoading}
      />

      <BranchHeader
        ahead={ahead}
        behind={behind}
        isDetached={isDetached}
        branches={branches}
        currentBranch={currentBranch}
        onCheckout={(name) => void checkoutBranch(name)}
        onCreateBranch={(name) => void createBranch(name, true)}
        onDeleteBranch={(name) => void deleteBranch(name)}
        actionBusy={actionBusy}
      />

      {actionStatus && (
        <div className="flex animate-pulse items-center gap-1 border-b border-border/40 px-3 py-1 text-ui-xs text-fg-muted">
          <Spinner size={10} className="animate-spin" />
          <span className="max-w-[180px] truncate">{actionStatus}</span>
        </div>
      )}

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

            if (row.kind === "history-header") {
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
                  <HistoryHeader
                    expanded={historyExpanded}
                    onToggle={() => setHistoryExpanded((v) => !v)}
                  />
                </div>
              );
            }

            if (row.kind === "staged-header") {
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
                  <SectionHeader
                    title="Staged"
                    count={row.count}
                    checkState={stagedCheckState}
                    actionBusy={actionBusy}
                    onToggleAll={handleUnstageAll}
                    onUnstageAll={handleUnstageAll}
                    mode="staged"
                  />
                </div>
              );
            }

            if (row.kind === "unstaged-header") {
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
                  <SectionHeader
                    title="Changes"
                    count={row.count}
                    checkState={unstagedCheckState}
                    actionBusy={actionBusy}
                    onToggleAll={handleStageAll}
                    onStageAll={handleStageAll}
                    mode="unstaged"
                  />
                </div>
              );
            }

            if (row.kind === "staged-entry") {
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
                  <FileRow
                    entry={row.entry}
                    isSelected={isSelected(row.entry.path)}
                    actionBusy={actionBusy}
                    mode="staged"
                    onToggle={handleToggleStaged}
                    onSelect={handleSelectFile}
                    onOpenDiff={(e) => void handleOpenDiff(e, true)}
                  />
                </div>
              );
            }

            if (row.kind === "unstaged-entry") {
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
                  <FileRow
                    entry={row.entry}
                    isSelected={isSelected(row.entry.path)}
                    actionBusy={actionBusy}
                    mode="unstaged"
                    onToggle={handleToggleUnstaged}
                    onSelect={handleSelectFile}
                    onOpenDiff={(e) => void handleOpenDiff(e, false)}
                    onDiscard={(e) => setDiscardEntry(e)}
                  />
                </div>
              );
            }

            if (row.kind === "clean-hint") {
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
                  <CleanTreeHint repoLabel={repoLabel} />
                </div>
              );
            }

            if (row.kind === "history-entry") {
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
                  <HistoryEntry commit={row.commit} />
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      <Dialog open={createBranchOpen} onOpenChange={setCreateBranchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ui-md">
              <GitBranchIcon size={18} className="text-primary" />
              Create Branch
            </DialogTitle>
            <DialogDescription className="text-ui-sm">
              Create a new branch from{" "}
              <span className="font-mono font-medium">{currentBranch}</span>.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createBranch(newBranchName.trim(), true);
                setNewBranchName("");
                setCreateBranchOpen(false);
              }
              if (e.key === "Escape") {
                setCreateBranchOpen(false);
                setNewBranchName("");
              }
            }}
            placeholder="Branch name"
            className="text-ui-sm"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCreateBranchOpen(false);
                setNewBranchName("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!newBranchName.trim() || actionBusy === "create-branch"}
              onClick={() => {
                void createBranch(newBranchName.trim(), true);
                setNewBranchName("");
                setCreateBranchOpen(false);
              }}
            >
              {actionBusy === "create-branch" ? (
                <>
                  <Spinner size={12} className="animate-spin mr-1" />
                  Creating…
                </>
              ) : (
                "Create & checkout"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!discardEntry} onOpenChange={() => setDiscardEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ui-md">
              <Trash size={18} className="text-status-error" />
              Discard Changes
            </DialogTitle>
            <DialogDescription className="text-ui-sm">
              Are you sure you want to discard all changes in{" "}
              <span className="font-mono font-medium">{discardEntry?.path}</span>? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDiscardEntry(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => discardEntry && handleDiscard(discardEntry)}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
