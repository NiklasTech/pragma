import { useState, useRef, useEffect, useCallback } from "react";
import { useGitStore } from "@/stores/git";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitBranch, Check, Plus, Trash, Warning, X, Spinner } from "@phosphor-icons/react";

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
    createBranch,
    deleteBranch,
    hasUncommittedChanges,
    actionBusy,
  } = useGitStore();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [warningBranch, setWarningBranch] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentBranch = snapshot?.repo.branch ?? repoLabel;

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

      setPendingBranch(branchName);
      await checkoutBranch(branchName);
      setPendingBranch(null);
      setOpen(false);
    },
    [currentBranch, hasUncommittedChanges, checkoutBranch],
  );

  const handleForceCheckout = async () => {
    if (!warningBranch) return;
    setShowWarning(false);
    setPendingBranch(warningBranch);
    await checkoutBranch(warningBranch);
    setPendingBranch(null);
    setWarningBranch(null);
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

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={actionBusy === "checkout"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1 text-[11px] font-medium transition-colors",
            open ? "bg-accent" : "hover:bg-foreground/10",
            actionBusy === "checkout" && "opacity-60",
          )}
        >
          {actionBusy === "checkout" ? (
            <Spinner size={11} className="animate-spin text-muted-foreground" />
          ) : (
            <GitBranch size={11} className="text-muted-foreground" />
          )}
          <span className="truncate max-w-[120px]">{currentBranch}</span>
          {isDetached && (
            <span className="rounded bg-muted/55 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              detached
            </span>
          )}
        </button>

        {ahead > 0 || behind > 0 ? (
          <div className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground">
            {ahead > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1 py-px">
                <ArrowUpIcon size={8} />
                {ahead}
              </span>
            )}
            {behind > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded border border-border/60 px-1 py-px">
                <ArrowDownIcon size={8} />
                {behind}
              </span>
            )}
          </div>
        ) : null}

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-md border border-border bg-popover shadow-md">
            <div className="max-h-72 overflow-y-auto py-1">
              {branches.map((branch) => {
                const isCurrent = branch.name === currentBranch;
                const isPending = pendingBranch === branch.name;
                return (
                  <div
                    key={branch.name}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-1.5 text-[12px]",
                      isCurrent
                        ? "bg-accent/50 font-medium text-foreground"
                        : "text-foreground/90 hover:bg-accent/30",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void handleSelectBranch(branch.name)}
                      disabled={isPending || isCurrent}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {isPending ? (
                        <Spinner
                          size={12}
                          className="animate-spin shrink-0 text-muted-foreground"
                        />
                      ) : isCurrent ? (
                        <Check size={12} className="shrink-0 text-primary" weight="bold" />
                      ) : (
                        <GitBranch size={12} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate">{branch.name}</span>
                    </button>

                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteBranch(branch.name)}
                        disabled={actionBusy === "delete-branch"}
                        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        title="Delete branch"
                      >
                        <Trash size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border px-2 py-1.5">
              {creating ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    ref={inputRef}
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Branch name"
                    className="h-7 text-[12px]"
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
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
                >
                  <Plus size={12} />
                  Create new branch
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={showWarning} onOpenChange={setShowWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[14px]">
              <Warning size={18} className="text-amber-500" />
              Uncommitted Changes
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              You have uncommitted changes. Checking out{" "}
              <span className="font-mono font-medium">{warningBranch}</span> may cause conflicts or
              overwrite your changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowWarning(false);
                setWarningBranch(null);
              }}
              className="text-[12px]"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => void handleForceCheckout()}
              disabled={pendingBranch !== null}
              className="text-[12px]"
            >
              {pendingBranch ? (
                <>
                  <Spinner size={12} className="animate-spin mr-1" />
                  Switching…
                </>
              ) : (
                "Switch Anyway"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ArrowUpIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="currentColor"
      style={{ transform: "rotate(180deg)" }}
    >
      <path d="M204.24 148.24l-72 72a6 6 0 0 1-8.48 0l-72-72a6 6 0 0 1 8.48-8.48L122 201.51V40a6 6 0 0 1 12 0v161.51l61.76-61.75a6 6 0 0 1 8.48 8.48Z" />
    </svg>
  );
}

function ArrowDownIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M204.24 148.24l-72 72a6 6 0 0 1-8.48 0l-72-72a6 6 0 0 1 8.48-8.48L122 201.51V40a6 6 0 0 1 12 0v161.51l61.76-61.75a6 6 0 0 1 8.48 8.48Z" />
    </svg>
  );
}
