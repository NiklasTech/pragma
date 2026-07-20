import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useGitStore,
  type GitStatusEntry,
  type CheckState,
  type GitCommit,
} from "@/shared/stores/git";
import { Button } from "@/shared/components/ui/button";
import { parseDiffToSides } from "@/shared/lib/diff";
import { useEditorStore } from "@/shared/stores/editor";
import { Spinner, Trash, GitBranch as GitBranchIcon, Warning } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";
import { GitToolbar } from "./git-status/GitToolbar";
import { BranchHeader } from "./git-status/BranchHeader";
import { CommitArea } from "./git-status/CommitArea";
import { SectionHeader } from "./git-status/SectionHeader";
import { FileRow } from "./git-status/FileRow";
import { CleanTreeHint } from "./git-status/CleanTreeHint";
import { HistoryHeader } from "./git-status/HistoryHeader";
import { HistoryEntry } from "./git-status/HistoryEntry";

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
      <PanelEmptyState
        icon={GitBranchIcon}
        title="Open a folder"
        description="Open a folder with a Git repository to view status and commit changes."
      />
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
    return <PanelEmptyState icon={Warning} title="Git status unavailable" description={error} />;
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
