import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useGitStore, type GitStatusEntry, type CheckState } from "@/shared/stores/git";
import { parseDiffToSides } from "@/shared/lib/diff";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { openGitDiffInSplit } from "../lib/gitDiffSplit";
import { GitToolbar } from "./git-status/GitToolbar";
import { BranchHeader } from "./git-status/BranchHeader";
import { GitStatusList } from "./git-status/GitStatusList";
import { ROW_HEIGHTS, buildRows, type GitRow } from "./git-status/rows";
import {
  GitStatusErrorState,
  GitStatusLoadingState,
  OpenFolderState,
} from "./git-status/GitStatusStates";
import { ActionStatusBanner, GitErrorAlert } from "./git-status/GitStatusBanners";
import { CreateBranchDialog } from "./git-status/CreateBranchDialog";
import { DiscardChangesDialog } from "./git-status/DiscardChangesDialog";
import { StashPanel } from "./StashPanel";
import { GitConflictEditor } from "./GitConflictEditor";
import { GutterBlame } from "./GutterBlame";

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
    openConflict,
  } = useGitStore();

  const editorPanelId = useEditorPanelId();

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
  const conflictFiles = useMemo(() => allFiles.filter((f) => f.is_conflicted), [allFiles]);
  const stagedFiles = useMemo(
    () => allFiles.filter((f) => f.is_staged && !f.is_conflicted),
    [allFiles],
  );
  const unstagedFiles = useMemo(
    () => allFiles.filter((f) => f.is_unstaged && !f.is_conflicted),
    [allFiles],
  );

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

      openGitDiffInSplit(editorPanelId, {
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

  const rows = useMemo<GitRow[]>(
    () =>
      buildRows({
        allFiles,
        conflictFiles,
        stagedFiles,
        unstagedFiles,
        commits,
        historyExpanded,
      }),
    [allFiles, conflictFiles, stagedFiles, unstagedFiles, commits, historyExpanded],
  );

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
    return <OpenFolderState />;
  }

  if (isLoading && !snapshot) {
    return <GitStatusLoadingState />;
  }

  if (error && !snapshot) {
    return <GitStatusErrorState error={error} />;
  }

  return (
    <div className="@container flex h-full min-w-0 flex-col">
      {error && <GitErrorAlert error={error} />}

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

      <StashPanel />

      {actionStatus && <ActionStatusBanner status={actionStatus} />}

      <GitStatusList
        scrollRef={scrollRef}
        virtualizer={virtualizer}
        rows={rows}
        commitMessage={commitMessage}
        setCommitMessage={setCommitMessage}
        handleKeyDown={handleKeyDown}
        canCommit={canCommit}
        stagedCount={stagedCount}
        actionBusy={actionBusy}
        onCommit={handleCommit}
        onOpenConflict={openConflict}
        historyExpanded={historyExpanded}
        onToggleHistory={() => setHistoryExpanded((v) => !v)}
        stagedCheckState={stagedCheckState}
        unstagedCheckState={unstagedCheckState}
        onStageAll={handleStageAll}
        onUnstageAll={handleUnstageAll}
        onToggleStaged={handleToggleStaged}
        onToggleUnstaged={handleToggleUnstaged}
        onSelectFile={handleSelectFile}
        onOpenDiff={handleOpenDiff}
        onDiscard={setDiscardEntry}
        isSelected={isSelected}
        repoLabel={repoLabel}
      />

      <CreateBranchDialog
        open={createBranchOpen}
        onOpenChange={setCreateBranchOpen}
        currentBranch={currentBranch}
        branchName={newBranchName}
        onBranchNameChange={setNewBranchName}
        actionBusy={actionBusy}
        onCreate={(name) => void createBranch(name, true)}
      />

      <DiscardChangesDialog
        entry={discardEntry}
        onCancel={() => setDiscardEntry(null)}
        onConfirm={handleDiscard}
      />

      <GitConflictEditor />
      <GutterBlame />
    </div>
  );
}
