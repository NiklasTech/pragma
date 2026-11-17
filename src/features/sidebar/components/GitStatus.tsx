import { useShallow } from "zustand/react/shallow";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useGitStore, type GitStatusEntry } from "@/shared/stores/git";
import { parseDiffToSides } from "@/shared/lib/diff";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { openGitDiffInSplit } from "../lib/gitDiffSplit";
import { ChangesHeader } from "./git-status/ChangesHeader";
import { StateSummary } from "./git-status/StateSummary";
import { type FileState } from "./git-status/fileState";
import { PullRequestSection } from "./git-status/PullRequestSection";
import { BranchHeader } from "./git-status/BranchHeader";
import { GitStatusList } from "./git-status/GitStatusList";
import { ROW_HEIGHTS, buildRows, countByState, type GitRow } from "./git-status/rows";
import { CommitArea } from "./git-status/CommitArea";
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
import { InputDialog } from "@/shared/components/ui/input-dialog";
import { CreateTagDialog } from "./git-graph/CreateTagDialog";
import { OperationBanner } from "./git-status/OperationBanner";
import { TagsDialog } from "./git-status/TagsDialog";
import { useGitCompareDialog } from "../lib/gitDialogs";
import { useUiSize } from "@/theme/useUiMetrics";
import { Button } from "@/shared/components/ui/button";

export function GitStatus() {
  const {
    snapshot,
    repoPath,
    isLoading,
    error,
    commitMessage,
    commitAmend,
    actionBusy,
    actionStatus,
    branches,
    loadStatus,
    loadBranches,
    stageFiles,
    unstageFiles,
    commit,
    amendCommit,
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
    renameBranch,
    mergeBranch,
    rebaseBranch,
    loadOperation,
  } = useGitStore(
    useShallow((s) => ({
      snapshot: s.snapshot,
      repoPath: s.repoPath,
      isLoading: s.isLoading,
      error: s.error,
      commitMessage: s.commitMessage,
      commitAmend: s.commitAmend,
      actionBusy: s.actionBusy,
      actionStatus: s.actionStatus,
      branches: s.branches,
      loadStatus: s.loadStatus,
      loadBranches: s.loadBranches,
      stageFiles: s.stageFiles,
      unstageFiles: s.unstageFiles,
      commit: s.commit,
      amendCommit: s.amendCommit,
      loadFileDiff: s.loadFileDiff,
      setCommitMessage: s.setCommitMessage,
      checkoutBranch: s.checkoutBranch,
      createBranch: s.createBranch,
      deleteBranch: s.deleteBranch,
      push: s.push,
      pull: s.pull,
      fetch: s.fetch,
      refreshAll: s.refreshAll,
      discardFiles: s.discardFiles,
      remotes: s.remotes,
      openConflict: s.openConflict,
      renameBranch: s.renameBranch,
      mergeBranch: s.mergeBranch,
      rebaseBranch: s.rebaseBranch,
      loadOperation: s.loadOperation,
    })),
  );

  const editorPanelId = useEditorPanelId();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filter, setFilter] = useState<FileState | null>(null);
  const [discardEntry, setDiscardEntry] = useState<GitStatusEntry | null>(null);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [renamingBranch, setRenamingBranch] = useState<string | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (repoPath && !snapshot && !isLoading) {
      void loadStatus();
    }
  }, [repoPath, snapshot, isLoading, loadStatus]);

  useEffect(() => {
    if (repoPath) void loadBranches();
  }, [repoPath, loadBranches]);

  useEffect(() => {
    if (snapshot) void loadOperation();
  }, [snapshot, loadOperation]);

  const allFiles = useMemo(() => snapshot?.changed_files ?? [], [snapshot]);
  const conflictFiles = useMemo(() => allFiles.filter((f) => f.is_conflicted), [allFiles]);
  const stagedFiles = useMemo(
    () => allFiles.filter((f) => f.is_staged && !f.is_conflicted),
    [allFiles],
  );
  const counts = useMemo(() => countByState(allFiles), [allFiles]);

  const stagedCount = stagedFiles.length;
  const canCommit =
    (commitAmend || stagedCount > 0) && commitMessage.trim().length > 0 && !actionBusy;

  const hasRemote = remotes.length > 0;
  const isDetached = snapshot?.repo.is_detached ?? false;
  const canPushPull = hasRemote && !isDetached;

  const handleStageAll = () => {
    const paths = rows.flatMap((row) =>
      row.kind === "file" && row.entry.is_unstaged ? [row.entry.path] : [],
    );
    if (paths.length > 0) void stageFiles(paths);
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
        repoPath: repoPath ?? undefined,
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
    void (commitAmend ? amendCommit() : commit());
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

  const activeFilter = filter !== null && counts[filter] > 0 ? filter : null;
  useEffect(() => {
    if (filter !== null && activeFilter === null) setFilter(null);
  }, [filter, activeFilter]);
  const rows = useMemo<GitRow[]>(
    () => buildRows({ allFiles, filter: activeFilter }),
    [allFiles, activeFilter],
  );

  const uiSize = useUiSize();
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const row = rows[index];
      return uiSize(row ? ROW_HEIGHTS[row.kind] : ROW_HEIGHTS.file);
    },
    overscan: 8,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, uiSize]);

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

      <ChangesHeader
        branch={
          <BranchHeader
            isDetached={isDetached}
            branches={branches}
            currentBranch={currentBranch}
            onCheckout={(name) => void checkoutBranch(name)}
            onCreateBranch={(name) => void createBranch(name, true)}
            onDeleteBranch={(name) => void deleteBranch(name)}
            onMergeBranch={(name) => void mergeBranch(name)}
            onRebaseOnto={(name) => void rebaseBranch(name)}
            onRenameBranch={setRenamingBranch}
            actionBusy={actionBusy}
          />
        }
        ahead={ahead}
        behind={behind}
        canPushPull={canPushPull}
        busy={actionBusy}
        onPull={() => void pull()}
        onPush={() => void push()}
        onFetch={() => void fetch()}
        onRefresh={() => void refreshAll()}
        onNewBranch={() => setCreateBranchOpen(true)}
        onTags={() => setTagsOpen(true)}
        onCompare={() => useGitCompareDialog.getState().show(currentBranch, "")}
      />

      {allFiles.length > 0 && (
        <StateSummary
          total={allFiles.length}
          counts={counts}
          filter={activeFilter}
          onFilter={setFilter}
          canStageAll={
            actionBusy === null && rows.some((row) => row.kind === "file" && row.entry.is_unstaged)
          }
          onStageAll={handleStageAll}
        />
      )}

      <OperationBanner conflictCount={conflictFiles.length} />

      <PullRequestSection />

      {actionStatus && <ActionStatusBanner status={actionStatus} />}

      <GitStatusList
        scrollRef={scrollRef}
        virtualizer={virtualizer}
        rows={rows}
        actionBusy={actionBusy}
        onOpenConflict={openConflict}
        onStage={(entry) => void stageFiles([entry.path])}
        onUnstage={(entry) => void unstageFiles([entry.path])}
        onSelectFile={handleSelectFile}
        onOpenDiff={handleOpenDiff}
        onDiscard={setDiscardEntry}
        isSelected={isSelected}
        repoLabel={repoLabel}
      />

      <CommitArea
        commitMessage={commitMessage}
        setCommitMessage={setCommitMessage}
        handleKeyDown={handleKeyDown}
        canCommit={canCommit}
        stagedCount={stagedCount}
        actionBusy={actionBusy}
        onCommit={handleCommit}
      />

      <StashPanel />

      <div className="flex shrink-0 items-center gap-1 border-t border-border-subtle px-2 py-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={() => useGitCompareDialog.getState().show(currentBranch, "")}
          className="h-6 px-1.5 text-[11px] text-fg-subtle"
        >
          compare
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setTagsOpen(true)}
          className="h-6 px-1.5 text-[11px] text-fg-subtle"
        >
          tags
        </Button>
      </div>

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

      <InputDialog
        open={renamingBranch !== null}
        onOpenChange={(open) => !open && setRenamingBranch(null)}
        title="Rename branch"
        label="New name"
        defaultValue={renamingBranch ?? ""}
        confirmLabel="Rename"
        onConfirm={(name) => {
          if (renamingBranch && name && name !== renamingBranch) {
            void renameBranch(renamingBranch, name);
          }
        }}
      />

      <TagsDialog
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        onCreateTag={() => {
          setTagsOpen(false);
          setTagDialogOpen(true);
        }}
      />

      <CreateTagDialog open={tagDialogOpen} target={null} onOpenChange={setTagDialogOpen} />

      <GitConflictEditor />
      <GutterBlame />
    </div>
  );
}
