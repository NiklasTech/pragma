import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGitStore } from "@/shared/stores/git";
import { useDockerStore } from "@/shared/stores/docker";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  GitBranch,
  Check,
  Plus,
  Trash,
  Warning,
  X,
  Spinner,
  ArrowUp,
  ArrowDown,
  ArrowsClockwise,
  DownloadSimple,
  Cube,
} from "@phosphor-icons/react";

interface BranchSwitcherProps {
  repoLabel: string;
  ahead: number;
  behind: number;
  isDetached: boolean;
}

export function BranchSwitcher({ repoLabel, ahead, behind, isDetached }: BranchSwitcherProps) {
  const {
    branches,
    snapshot,
    checkoutBranch,
    smartCheckout,
    createBranch,
    deleteBranch,
    hasUncommittedChanges,
    actionBusy,
    actionStatus,
    actionProgress,
    push,
    pull,
    fetch,
    remotes,
    remoteBranches,
    pushPullError,
    clearPushPullError,
    loadRemoteBranches,
  } = useGitStore();
  const { workspaceRoot, composeUpBuild } = useDockerStore();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [warningBranch, setWarningBranch] = useState<string | null>(null);
  const [showPullOptions, setShowPullOptions] = useState(false);
  const [showFetchDialog, setShowFetchDialog] = useState(false);
  const [selectedFetchBranch, setSelectedFetchBranch] = useState<string>("");
  const [showComposeRebuild, setShowComposeRebuild] = useState(false);
  const [composeRebuildBranch, setComposeRebuildBranch] = useState<string | null>(null);
  const [composeRebuildAfterSwitch, setComposeRebuildAfterSwitch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentBranch = snapshot?.repo.branch ?? repoLabel;
  const hasRemote = remotes.length > 0;
  const canPushPull = hasRemote && !isDetached;

  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating]);

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

  const checkComposeChange = useCallback(
    async (sourceBranch: string, targetBranch: string) => {
      const repoPath = useGitStore.getState().repoPath;
      if (!repoPath || !workspaceRoot) return false;
      try {
        return await invoke<boolean>("docker_compose_changed_between_branches", {
          req: { repoPath, workspaceRoot, sourceBranch, targetBranch },
        });
      } catch {
        return false;
      }
    },
    [workspaceRoot],
  );

  const handleSelectBranch = useCallback(
    async (branchName: string) => {
      if (branchName === currentBranch) {
        setOpen(false);
        return;
      }

      const hasChanges = await hasUncommittedChanges();
      if (hasChanges) {
        setWarningBranch(branchName);
        setShowWarning(true);
        setOpen(false);
        return;
      }

      const composeChanged = await checkComposeChange(currentBranch, branchName);
      if (composeChanged) {
        setComposeRebuildBranch(branchName);
        setComposeRebuildAfterSwitch(false);
        setShowComposeRebuild(true);
        setOpen(false);
        return;
      }

      setPendingBranch(branchName);
      await checkoutBranch(branchName);
      setPendingBranch(null);
      setOpen(false);
    },
    [currentBranch, hasUncommittedChanges, checkoutBranch, checkComposeChange],
  );

  const handleSmartSwitch = async () => {
    if (!warningBranch) return;
    setShowWarning(false);
    setPendingBranch(warningBranch);
    const sourceBranch = currentBranch;
    await smartCheckout(warningBranch);
    setPendingBranch(null);
    setWarningBranch(null);
    const composeChanged = await checkComposeChange(sourceBranch, warningBranch);
    if (composeChanged) {
      setComposeRebuildBranch(warningBranch);
      setComposeRebuildAfterSwitch(true);
      setShowComposeRebuild(true);
    }
  };

  const handleNormalSwitch = async () => {
    if (!warningBranch) return;
    setShowWarning(false);
    setPendingBranch(warningBranch);
    const sourceBranch = currentBranch;
    await checkoutBranch(warningBranch);
    setPendingBranch(null);
    setWarningBranch(null);
    const composeChanged = await checkComposeChange(sourceBranch, warningBranch);
    if (composeChanged) {
      setComposeRebuildBranch(warningBranch);
      setComposeRebuildAfterSwitch(true);
      setShowComposeRebuild(true);
    }
  };

  const handleComposeRebuildConfirm = async (rebuild: boolean) => {
    const branch = composeRebuildBranch;
    const afterSwitch = composeRebuildAfterSwitch;
    setShowComposeRebuild(false);
    setComposeRebuildBranch(null);
    setComposeRebuildAfterSwitch(false);
    if (!branch) return;

    if (!afterSwitch) {
      setPendingBranch(branch);
      await checkoutBranch(branch);
      setPendingBranch(null);
    }
    if (rebuild) {
      await composeUpBuild();
    }
  };

  const handleCreateBranch = async () => {
    const name = newBranchName.trim();
    if (!name) return;
    await createBranch(name, true);
    setCreating(false);
    setNewBranchName("");
    setOpen(false);
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (branchName === currentBranch) return;
    await deleteBranch(branchName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCreateBranch();
    }
    if (e.key === "Escape") {
      setCreating(false);
      setNewBranchName("");
    }
  };

  const handlePush = async () => {
    await push();
  };

  const handlePull = async (rebase: boolean) => {
    setShowPullOptions(false);
    await pull(undefined, undefined, rebase);
  };

  const openFetchDialog = async () => {
    await loadRemoteBranches();
    setSelectedFetchBranch("");
    setShowFetchDialog(true);
  };

  const handleFetchBranch = async () => {
    setShowFetchDialog(false);
    if (selectedFetchBranch) {
      await fetch(undefined, selectedFetchBranch);
    } else {
      await fetch();
    }
  };

  const isPushBusy = actionBusy === "push";
  const isPullBusy = actionBusy === "pull";
  const isFetchBusy = actionBusy === "fetch";

  return (
    <>
      <div className="relative flex items-center gap-2" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={actionBusy === "checkout"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-bg-hover px-2 py-1 text-ui-xs font-medium transition-colors",
            open ? "bg-bg-active" : "hover:bg-bg-hover",
            actionBusy === "checkout" && "opacity-60",
          )}
        >
          {actionBusy === "checkout" ? (
            <Spinner size={11} className="animate-spin text-fg-muted" />
          ) : (
            <GitBranch size={11} className="text-fg-muted" />
          )}
          <span className="max-w-[120px] truncate">{currentBranch}</span>
          {isDetached && (
            <span className="rounded bg-bg-hover px-1 py-px text-ui-2xs font-medium uppercase tracking-wider text-fg-muted">
              detached
            </span>
          )}
        </button>

        {ahead > 0 || behind > 0 ? (
          <div className="flex items-center gap-0.5 text-ui-xs font-semibold text-fg-muted">
            {ahead > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1 py-px">
                <ArrowUp size={8} />
                {ahead}
              </span>
            )}
            {behind > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1 py-px">
                <ArrowDown size={8} />
                {behind}
              </span>
            )}
          </div>
        ) : null}

        {/* Status indicator */}
        {actionStatus && (
          <div className="flex animate-pulse items-center gap-1 text-ui-xs text-fg-muted">
            <Spinner size={10} className="animate-spin" />
            <span className="max-w-[100px] truncate">{actionStatus}</span>
            {actionProgress && actionProgress.total_objects > 0 && (
              <span className="text-ui-xs">
                {actionProgress.received_objects}/{actionProgress.total_objects}
              </span>
            )}
          </div>
        )}

        {/* Push / Pull / Fetch buttons */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => void handlePush()}
            disabled={!canPushPull || isPushBusy || ahead === 0}
            title={!hasRemote ? "No remote configured" : ahead === 0 ? "Nothing to push" : "Push"}
            className={cn(
              "rounded-md p-1 outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.92]",
              canPushPull && ahead > 0
                ? "text-fg-default/70 hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40"
                : "cursor-not-allowed text-fg-muted/30",
            )}
          >
            {isPushBusy ? <Spinner size={12} className="animate-spin" /> : <ArrowUp size={12} />}
          </button>

          <button
            type="button"
            onClick={() => setShowPullOptions(!showPullOptions)}
            disabled={!canPushPull || isPullBusy || behind === 0}
            title={
              !hasRemote ? "No remote configured" : behind === 0 ? "Already up to date" : "Pull"
            }
            className={cn(
              "rounded-md p-1 outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.92]",
              canPushPull && behind > 0
                ? "text-fg-default/70 hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40"
                : "cursor-not-allowed text-fg-muted/30",
            )}
          >
            {isPullBusy ? <Spinner size={12} className="animate-spin" /> : <ArrowDown size={12} />}
          </button>

          <button
            type="button"
            onClick={() => void openFetchDialog()}
            disabled={!canPushPull || isFetchBusy}
            title={!hasRemote ? "No remote configured" : "Fetch"}
            className={cn(
              "rounded-md p-1 outline-none transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.92]",
              canPushPull
                ? "text-fg-default/70 hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40"
                : "cursor-not-allowed text-fg-muted/30",
            )}
          >
            {isFetchBusy ? (
              <Spinner size={12} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={12} />
            )}
          </button>
        </div>

        {/* Pull options dropdown */}
        {showPullOptions && (
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-border/60 bg-bg-elevated shadow-lg shadow-black/10">
            <button
              type="button"
              onClick={() => void handlePull(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-ui-sm text-fg-default hover:bg-bg-hover"
            >
              <ArrowDown size={12} />
              Pull (merge)
            </button>
            <button
              type="button"
              onClick={() => void handlePull(true)}
              className="flex w-full items-center gap-2 px-3 py-2 text-ui-sm text-fg-default hover:bg-bg-hover"
            >
              <ArrowsClockwise size={12} />
              Pull (rebase)
            </button>
          </div>
        )}

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border/60 bg-bg-elevated shadow-lg shadow-black/10">
            <div className="max-h-72 overflow-y-auto py-1">
              {branches.map((branch) => {
                const isCurrent = branch.name === currentBranch;
                const isPending = pendingBranch === branch.name;
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
                    <button
                      type="button"
                      onClick={() => void handleSelectBranch(branch.name)}
                      disabled={isPending || isCurrent}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {isPending ? (
                        <Spinner size={12} className="shrink-0 animate-spin text-fg-muted" />
                      ) : isCurrent ? (
                        <Check size={12} className="shrink-0 text-primary" weight="bold" />
                      ) : (
                        <GitBranch size={12} className="shrink-0 text-fg-muted" />
                      )}
                      <span className="truncate">{branch.name}</span>
                    </button>

                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteBranch(branch.name)}
                        disabled={actionBusy === "delete-branch"}
                        className="shrink-0 rounded p-0.5 text-fg-muted opacity-0 transition-opacity hover:text-status-error group-hover:opacity-100"
                        title="Delete branch"
                      >
                        <Trash size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border/60 px-2 py-1.5">
              {creating ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    ref={inputRef}
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Branch name"
                    className="h-7 text-ui-sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => void handleCreateBranch()}
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

      {/* Uncommitted changes smart switch dialog */}
      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ui-md">
              <Warning size={18} className="text-status-warning" />
              Uncommitted Changes
            </DialogTitle>
            <DialogDescription className="text-ui-sm">
              You have{" "}
              <span className="font-medium">
                {snapshot?.changed_files.length ?? 0} changed file
                {(snapshot?.changed_files.length ?? 0) === 1 ? "" : "s"}
              </span>
              . How do you want to switch to{" "}
              <span className="font-mono font-medium">{warningBranch}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleSmartSwitch()}
              disabled={pendingBranch !== null}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border border-border/60 bg-bg-hover px-3 py-2.5 text-left transition-colors hover:bg-bg-active",
                pendingBranch !== null && "opacity-60 cursor-not-allowed",
              )}
            >
              <ArrowsClockwise size={18} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="text-ui-sm font-medium">Smart Switch</div>
                <div className="text-ui-xs text-fg-muted">
                  Stash changes, switch branch, then restore changes and workspace
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleNormalSwitch()}
              disabled={pendingBranch !== null}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-bg-hover",
                pendingBranch !== null && "opacity-60 cursor-not-allowed",
              )}
            >
              <GitBranch size={18} className="shrink-0 text-fg-muted" />
              <div className="min-w-0">
                <div className="text-ui-sm font-medium">Normal Switch</div>
                <div className="text-ui-xs text-fg-muted">
                  Switch branch without stashing (may fail or conflict)
                </div>
              </div>
            </button>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowWarning(false);
                setWarningBranch(null);
              }}
              disabled={pendingBranch !== null}
              className="text-ui-sm"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compose rebuild dialog */}
      <Dialog open={showComposeRebuild} onOpenChange={setShowComposeRebuild}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ui-md">
              <Cube size={18} className="text-primary" />
              Compose changed — rebuild?
            </DialogTitle>
            <DialogDescription className="text-ui-sm">
              docker-compose.yml differs between branches. Rebuild containers now?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleComposeRebuildConfirm(false)}
              className="text-ui-sm"
            >
              No
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleComposeRebuildConfirm(true)}
              className="text-ui-sm"
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fetch dialog with branch selection */}
      <Dialog open={showFetchDialog} onOpenChange={setShowFetchDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ui-md">
              <DownloadSimple size={18} className="text-primary" />
              Fetch from Remote
            </DialogTitle>
            <DialogDescription className="text-ui-sm">
              Select a remote branch to fetch, or fetch all branches.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedFetchBranch("")}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-ui-sm transition-colors",
                selectedFetchBranch === ""
                  ? "bg-bg-active font-medium text-fg-default"
                  : "text-fg-default hover:bg-bg-hover",
              )}
            >
              <ArrowsClockwise size={12} />
              Fetch all branches
            </button>

            {remoteBranches.length === 0 && (
              <p className="px-3 py-2 text-ui-xs text-fg-muted">
                No remote branches found. Fetch all to discover branches.
              </p>
            )}

            {remoteBranches.map((rb) => (
              <button
                key={rb.name}
                type="button"
                onClick={() => setSelectedFetchBranch(rb.name)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-ui-sm transition-colors",
                  selectedFetchBranch === rb.name
                    ? "bg-bg-active/50 font-medium text-fg-default"
                    : "text-fg-default/90 hover:bg-bg-hover",
                )}
              >
                <GitBranch size={12} className="text-fg-muted" />
                {rb.name}
              </button>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFetchDialog(false)}
              className="text-ui-sm"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleFetchBranch()}
              disabled={isFetchBusy}
              className="text-ui-sm"
            >
              {isFetchBusy ? (
                <>
                  <Spinner size={12} className="animate-spin mr-1" />
                  Fetching…
                </>
              ) : selectedFetchBranch ? (
                `Fetch ${selectedFetchBranch}`
              ) : (
                "Fetch all"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push/Pull error dialog */}
      <Dialog open={!!pushPullError} onOpenChange={clearPushPullError}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-ui-md">
              <Warning size={18} className="text-status-error" />
              Git Remote Error
            </DialogTitle>
            <DialogDescription className="text-ui-sm">{pushPullError}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={clearPushPullError} className="text-ui-sm">
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
