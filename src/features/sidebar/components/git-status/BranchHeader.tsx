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
} from "@/shared/components/ui/context-menu";
import {
  Spinner,
  GitBranch as GitBranchIcon,
  CaretDown,
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  X,
} from "@phosphor-icons/react";

export function BranchHeader({
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
    <div className="relative flex items-center justify-between gap-2 px-3 py-2" ref={menuRef}>
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
          <span className="inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-px text-status-success">
            <ArrowDown size={9} />
            {behind}
          </span>
        )}
        {ahead > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-px text-status-info">
            <ArrowUp size={9} />
            {ahead}
          </span>
        )}
        {ahead === 0 && behind === 0 && (
          <span className="rounded border border-border px-1.5 py-px text-fg-subtle">
            up to date
          </span>
        )}
      </div>

      {open && (
        <div className="absolute left-3 top-full z-50 mt-1 w-64 rounded-md border border-border bg-bg-elevated shadow-lg shadow-black/10">
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
