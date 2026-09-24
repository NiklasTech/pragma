import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { invoke } from "@tauri-apps/api/core";
import { useGitStore } from "@/shared/stores/git";
import { CommitTable } from "./git-graph/CommitTable";
import { GitGraphDialogs } from "./git-graph/GitGraphDialogs";
import {
  LoadErrorState,
  LoadingCommitsState,
  NoCommitsState,
  NoRepositoryState,
} from "./git-graph/GitGraphStates";
import type { ColumnKey } from "./git-graph/columns";
import { NEAR_BOTTOM_PX, PAGE_SIZE, ROW_HEIGHT, TABLE_HEADER_HEIGHT } from "./git-graph/constants";
import { normalizeError } from "./git-graph/format";
import type { ConfirmDialogState, GitLogEntry, LoadStatus } from "./git-graph/types";
import { useGraphLayout } from "./git-graph/useGraphLayout";

export function GitGraph() {
  const {
    repoPath,
    snapshot,
    checkoutCommit,
    createBranchFromCommit,
    cherryPickCommit,
    revertCommit,
    resetToCommit,
  } = useGitStore();
  const [commits, setCommits] = useState<GitLogEntry[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [endReached, setEndReached] = useState(false);
  const [activeSha, setActiveSha] = useState<string | null>(null);
  const [collapsedCols, setCollapsedCols] = useState<Set<ColumnKey>>(new Set());

  const [detailsSha, setDetailsSha] = useState<string | null>(null);
  const [branchDialogSha, setBranchDialogSha] = useState<string | null>(null);
  const [branchNameInput, setBranchNameInput] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const requestIdRef = useRef(0);
  const loadMoreRequestIdRef = useRef(0);
  const inflightMoreRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { graphByCommit, maxLaneCount } = useGraphLayout(commits);

  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: TABLE_HEADER_HEIGHT,
    getItemKey: (index) => commits[index]?.sha ?? index,
  });

  const loadInitial = useCallback(async () => {
    if (!repoPath) return;
    const requestId = ++requestIdRef.current;
    setLoadStatus("initial");
    setError(null);
    try {
      const result = await invoke<{ entries: GitLogEntry[] }>("git_log_entries", {
        repoPath,
        limit: PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;
      setCommits(result.entries);
      setLoadStatus("idle");
      setEndReached(result.entries.length < PAGE_SIZE);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(normalizeError(err));
      setLoadStatus("error");
    }
  }, [repoPath]);

  const loadMore = useCallback(async () => {
    if (!repoPath || inflightMoreRef.current || endReached) return;
    if (loadStatus !== "idle") return;
    const last = commits[commits.length - 1];
    if (!last) return;
    inflightMoreRef.current = true;
    const requestId = ++loadMoreRequestIdRef.current;
    setLoadStatus("more");
    try {
      const result = await invoke<{ entries: GitLogEntry[] }>("git_log_entries", {
        repoPath,
        limit: PAGE_SIZE,
        beforeSha: last.sha,
      });
      if (requestId !== loadMoreRequestIdRef.current) return;
      setCommits((prev) => {
        const seen = new Set(prev.map((c) => c.sha));
        const merged = [...prev];
        for (const e of result.entries) if (!seen.has(e.sha)) merged.push(e);
        return merged;
      });
      if (result.entries.length < PAGE_SIZE) setEndReached(true);
      setLoadStatus("idle");
    } catch (err) {
      if (requestId !== loadMoreRequestIdRef.current) return;
      setError(normalizeError(err));
      setLoadStatus("error");
    } finally {
      if (requestId === loadMoreRequestIdRef.current) {
        inflightMoreRef.current = false;
      }
    }
  }, [commits, endReached, loadStatus, repoPath]);

  useEffect(() => {
    setCommits([]);
    setActiveSha(null);
    setEndReached(false);
    ++loadMoreRequestIdRef.current;
    inflightMoreRef.current = false;
    if (repoPath) void loadInitial();
  }, [repoPath, loadInitial]);

  useEffect(() => {
    if (!repoPath || !snapshot || loadStatus !== "idle" || commits.length === 0) return;
    void loadInitial();
  }, [snapshot, repoPath, loadStatus, commits.length, loadInitial]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < NEAR_BOTTOM_PX) {
      void loadMore();
    }
  }, [loadMore]);

  useEffect(() => {
    if (loadStatus !== "idle" || endReached || commits.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable > NEAR_BOTTOM_PX) return;
    const id = window.setTimeout(() => void loadMore(), 0);
    return () => window.clearTimeout(id);
  }, [commits.length, endReached, loadMore, loadStatus]);

  const toggleCol = useCallback((key: ColumnKey) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleCopySha = async (sha: string) => {
    await navigator.clipboard.writeText(sha);
  };

  const handleCheckoutCommit = async (sha: string) => {
    setConfirmDialog({
      type: "checkout",
      sha,
      title: "Checkout commit?",
      description: `This will detach HEAD and move the working tree to ${sha.slice(0, 7)}. Any uncommitted changes may be lost.`,
    });
  };

  const handleCreateBranch = async () => {
    if (!branchDialogSha || !branchNameInput.trim()) return;
    await createBranchFromCommit(branchNameInput.trim(), branchDialogSha, true);
    setBranchDialogSha(null);
    setBranchNameInput("");
  };

  const handleCherryPick = async (sha: string) => {
    setConfirmDialog({
      type: "cherry-pick",
      sha,
      title: "Cherry-pick commit?",
      description: `Apply the changes from ${sha.slice(0, 7)} onto the current branch?`,
    });
  };

  const handleRevert = async (sha: string) => {
    setConfirmDialog({
      type: "revert",
      sha,
      title: "Revert commit?",
      description: `Create a new commit that undoes ${sha.slice(0, 7)}?`,
    });
  };

  const handleReset = async (sha: string, mode: "soft" | "mixed" | "hard") => {
    const modeLabels: Record<typeof mode, string> = {
      soft: "Soft reset keeps changes staged.",
      mixed: "Mixed reset keeps changes unstaged.",
      hard: "This will discard all working tree changes. This cannot be undone.",
    };
    setConfirmDialog({
      type: `reset-${mode}`,
      sha,
      title: `Reset ${mode}?`,
      description: `Move HEAD to ${sha.slice(0, 7)}. ${modeLabels[mode]}`,
    });
  };

  const executeConfirm = async () => {
    if (!confirmDialog) return;
    const { type, sha } = confirmDialog;
    if (type === "checkout") {
      await checkoutCommit(sha);
    } else if (type === "cherry-pick") {
      await cherryPickCommit(sha);
    } else if (type === "revert") {
      await revertCommit(sha);
    } else if (type === "reset-soft") {
      await resetToCommit(sha, "soft");
    } else if (type === "reset-mixed") {
      await resetToCommit(sha, "mixed");
    } else if (type === "reset-hard") {
      await resetToCommit(sha, "hard");
    }
    setConfirmDialog(null);
  };

  if (!repoPath) {
    return <NoRepositoryState />;
  }

  if (loadStatus === "initial" && commits.length === 0) {
    return <LoadingCommitsState />;
  }

  if (loadStatus === "error" && commits.length === 0) {
    return <LoadErrorState error={error} />;
  }

  if (commits.length === 0) {
    return <NoCommitsState />;
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <CommitTable
        virtualizer={virtualizer}
        scrollRef={scrollRef}
        onScroll={handleScroll}
        commits={commits}
        loadStatus={loadStatus}
        endReached={endReached}
        activeSha={activeSha}
        onSetActive={setActiveSha}
        graphByCommit={graphByCommit}
        maxLaneCount={maxLaneCount}
        collapsedCols={collapsedCols}
        onToggleCol={toggleCol}
        onViewDetails={setDetailsSha}
        onCopySha={handleCopySha}
        onCheckout={handleCheckoutCommit}
        onCreateBranch={setBranchDialogSha}
        onCherryPick={handleCherryPick}
        onRevert={handleRevert}
        onReset={handleReset}
      />

      <GitGraphDialogs
        detailsSha={detailsSha}
        onCloseDetails={() => setDetailsSha(null)}
        branchDialogSha={branchDialogSha}
        branchNameInput={branchNameInput}
        onBranchNameChange={setBranchNameInput}
        onCloseBranchDialog={() => setBranchDialogSha(null)}
        onCreateBranch={() => void handleCreateBranch()}
        confirmDialog={confirmDialog}
        onCloseConfirm={() => setConfirmDialog(null)}
        onConfirm={() => void executeConfirm()}
      />
    </div>
  );
}
