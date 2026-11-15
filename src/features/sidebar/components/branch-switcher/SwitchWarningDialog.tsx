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
import { ArrowsClockwise, GitBranch, Warning } from "@phosphor-icons/react";

interface SwitchWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changedFileCount: number;
  warningBranch: string | null;
  pendingBranch: string | null;
  onSmartSwitch: () => void;
  onNormalSwitch: () => void;
  onCancel: () => void;
}

export function SwitchWarningDialog({
  open,
  onOpenChange,
  changedFileCount,
  warningBranch,
  pendingBranch,
  onSmartSwitch,
  onNormalSwitch,
  onCancel,
}: SwitchWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ui-md">
            <Warning size={18} className="text-status-warning" />
            Uncommitted Changes
          </DialogTitle>
          <DialogDescription className="text-ui-sm">
            You have{" "}
            <span className="font-medium">
              {changedFileCount} changed file
              {changedFileCount === 1 ? "" : "s"}
            </span>
            . How do you want to switch to{" "}
            <span className="font-mono font-medium">{warningBranch}</span>?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Button
            variant="secondary"
            onClick={() => onSmartSwitch()}
            disabled={pendingBranch !== null}
            className={cn(
              "h-auto w-full justify-start gap-3 px-3 py-2.5 text-left font-normal whitespace-normal",
            )}
          >
            <ArrowsClockwise size={18} className="shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-ui-sm font-medium">Smart Switch</div>
              <div className="text-ui-xs text-fg-muted">
                Stash changes, switch branch, then restore changes and workspace
              </div>
            </div>
          </Button>
          <Button
            variant="ghost"
            onClick={() => onNormalSwitch()}
            disabled={pendingBranch !== null}
            className={cn(
              "h-auto w-full justify-start gap-3 px-3 py-2.5 text-left font-normal whitespace-normal text-fg-default ring-1 ring-border ring-inset",
            )}
          >
            <GitBranch size={18} className="shrink-0 text-fg-muted" />
            <div className="min-w-0">
              <div className="text-ui-sm font-medium">Normal Switch</div>
              <div className="text-ui-xs text-fg-muted">
                Switch branch without stashing (may fail or conflict)
              </div>
            </div>
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={pendingBranch !== null}
            className="text-ui-sm"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
