import { useEffect, useRef, useState } from "react";
import { type GitBranch } from "@/shared/stores/git";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/components/ui/context-menu";
import { useGitCompareDialog } from "../../lib/gitDialogs";
import {
  Spinner,
  GitBranch as GitBranchIcon,
  CaretDown,
  Check,
  Plus,
  X,
} from "@phosphor-icons/react";

export function BranchHeader({
  isDetached,
  branches,
  currentBranch,
  onCheckout,
  onCreateBranch,
  onDeleteBranch,
  onMergeBranch,
  onRebaseOnto,
  onRenameBranch,
  actionBusy,
}: {
  isDetached: boolean;
  branches: GitBranch[];
  currentBranch: string;
  onCheckout: (name: string) => void;
  onCreateBranch: (name: string) => void;
  onDeleteBranch: (name: string) => void;
  onMergeBranch: (name: string) => void;
  onRebaseOnto: (name: string) => void;
  onRenameBranch: (name: string) => void;
  actionBusy: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      // The branch context menu is portaled, so it lies outside menuRef.
      if (target.closest?.('[data-slot="context-menu-content"]')) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
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
    <div className="relative flex min-w-0 items-center" ref={menuRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        disabled={actionBusy === "checkout"}
        title={`Branch ${currentBranch}`}
        className={cn("min-w-0 max-w-44 justify-start gap-1.5 px-2", open && "ring-fg-default/35")}
      >
        {actionBusy === "checkout" ? (
          <Spinner size={12} className="shrink-0 animate-spin text-fg-muted" />
        ) : (
          <GitBranchIcon size={12} className="shrink-0 text-primary" />
        )}
        <span className="min-w-0 flex-1 truncate text-left">{currentBranch}</span>
        <CaretDown size={10} className="shrink-0 text-fg-subtle" />
        {isDetached && (
          <span className="shrink-0 rounded bg-bg-hover px-1 py-px text-ui-2xs font-medium uppercase tracking-wider text-fg-muted">
            detached
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-[var(--shadow-md)]">
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
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => {
                          if (!isCurrent) onCheckout(branch.name);
                          setOpen(false);
                        }}
                        disabled={isCurrent}
                        className="min-w-0 flex-1 justify-start gap-2 px-0 text-left text-ui-sm font-normal text-fg-default hover:bg-transparent disabled:opacity-100"
                      >
                        {isCurrent ? (
                          <Check size={12} className="shrink-0 text-primary" weight="bold" />
                        ) : (
                          <GitBranchIcon size={12} className="shrink-0 text-fg-muted" />
                        )}
                        <span className="truncate">{branch.name}</span>
                      </Button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56">
                      {!isCurrent && (
                        <>
                          <ContextMenuItem onClick={() => onCheckout(branch.name)}>
                            Checkout
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            onClick={() => {
                              setOpen(false);
                              onMergeBranch(branch.name);
                            }}
                          >
                            Merge into {currentBranch}
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              setOpen(false);
                              onRebaseOnto(branch.name);
                            }}
                          >
                            Rebase {currentBranch} onto this
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              setOpen(false);
                              useGitCompareDialog.getState().show(currentBranch, branch.name);
                            }}
                          >
                            Compare with {currentBranch}
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                        </>
                      )}
                      <ContextMenuItem
                        onClick={() => {
                          setOpen(false);
                          onRenameBranch(branch.name);
                        }}
                      >
                        Rename
                      </ContextMenuItem>
                      {!isCurrent && (
                        <ContextMenuItem
                          onClick={() => onDeleteBranch(branch.name)}
                          className="text-status-error focus:text-status-error"
                        >
                          Delete
                        </ContextMenuItem>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border px-2 py-1.5">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreating(true)}
                className="w-full justify-start gap-1.5 px-2 text-ui-sm font-normal"
              >
                <Plus size={12} />
                Create new branch
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
