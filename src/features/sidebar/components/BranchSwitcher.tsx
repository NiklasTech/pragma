import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useGitStore } from "@/shared/stores/git";
import { useDockerStore } from "@/shared/stores/docker";
import { BranchTrigger } from "./branch-switcher/BranchTrigger";
import { SyncControls } from "./branch-switcher/SyncControls";
import { BranchListPopover } from "./branch-switcher/BranchListPopover";
import { SwitchWarningDialog } from "./branch-switcher/SwitchWarningDialog";
import { ComposeRebuildDialog } from "./branch-switcher/ComposeRebuildDialog";
import { FetchDialog } from "./branch-switcher/FetchDialog";
import { PushPullErrorDialog } from "./branch-switcher/PushPullErrorDialog";

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
        <BranchTrigger
          open={open}
          onToggle={() => setOpen(!open)}
          isCheckoutBusy={actionBusy === "checkout"}
          currentBranch={currentBranch}
          isDetached={isDetached}
          ahead={ahead}
          behind={behind}
          actionStatus={actionStatus}
          actionProgress={actionProgress}
        />

        <SyncControls
          ahead={ahead}
          behind={behind}
          hasRemote={hasRemote}
          canPushPull={canPushPull}
          isPushBusy={isPushBusy}
          isPullBusy={isPullBusy}
          isFetchBusy={isFetchBusy}
          showPullOptions={showPullOptions}
          onTogglePullOptions={() => setShowPullOptions(!showPullOptions)}
          onPush={handlePush}
          onPull={handlePull}
          onFetch={openFetchDialog}
        />

        {open && (
          <BranchListPopover
            branches={branches}
            currentBranch={currentBranch}
            pendingBranch={pendingBranch}
            actionBusy={actionBusy}
            creating={creating}
            newBranchName={newBranchName}
            inputRef={inputRef}
            onSelectBranch={handleSelectBranch}
            onDeleteBranch={handleDeleteBranch}
            onNameChange={setNewBranchName}
            onKeyDown={handleKeyDown}
            onCreateSubmit={handleCreateBranch}
            onCreateClick={() => setCreating(true)}
            onCancelCreate={() => {
              setCreating(false);
              setNewBranchName("");
            }}
          />
        )}
      </div>

      <SwitchWarningDialog
        open={showWarning}
        onOpenChange={setShowWarning}
        changedFileCount={snapshot?.changed_files.length ?? 0}
        warningBranch={warningBranch}
        pendingBranch={pendingBranch}
        onSmartSwitch={handleSmartSwitch}
        onNormalSwitch={handleNormalSwitch}
        onCancel={() => {
          setShowWarning(false);
          setWarningBranch(null);
        }}
      />

      <ComposeRebuildDialog
        open={showComposeRebuild}
        onOpenChange={setShowComposeRebuild}
        onConfirm={handleComposeRebuildConfirm}
      />

      <FetchDialog
        open={showFetchDialog}
        onOpenChange={setShowFetchDialog}
        remoteBranches={remoteBranches}
        selectedFetchBranch={selectedFetchBranch}
        onSelectBranch={setSelectedFetchBranch}
        onCancel={() => setShowFetchDialog(false)}
        onConfirm={handleFetchBranch}
        isFetchBusy={isFetchBusy}
      />

      <PushPullErrorDialog
        error={pushPullError}
        onOpenChange={clearPushPullError}
        onDismiss={clearPushPullError}
      />
    </>
  );
}
