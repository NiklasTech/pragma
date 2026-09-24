import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import type { GitRemoteBranch } from "@/shared/stores/git";
import { ArrowsClockwise, DownloadSimple, GitBranch, Spinner } from "@phosphor-icons/react";

interface FetchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remoteBranches: GitRemoteBranch[];
  selectedFetchBranch: string;
  onSelectBranch: (branchName: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isFetchBusy: boolean;
}

export function FetchDialog({
  open,
  onOpenChange,
  remoteBranches,
  selectedFetchBranch,
  onSelectBranch,
  onCancel,
  onConfirm,
  isFetchBusy,
}: FetchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            onClick={() => onSelectBranch("")}
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
              onClick={() => onSelectBranch(rb.name)}
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
          <Button variant="outline" size="sm" onClick={onCancel} className="text-ui-sm">
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onConfirm()}
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
  );
}
