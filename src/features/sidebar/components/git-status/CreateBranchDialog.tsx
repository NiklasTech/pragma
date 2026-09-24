import { GitBranch as GitBranchIcon, Spinner } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";

export function CreateBranchDialog({
  open,
  onOpenChange,
  currentBranch,
  branchName,
  onBranchNameChange,
  actionBusy,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBranch: string;
  branchName: string;
  onBranchNameChange: (value: string) => void;
  actionBusy: string | null;
  onCreate: (name: string) => void;
}) {
  const submit = () => {
    onCreate(branchName.trim());
    onBranchNameChange("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ui-md">
            <GitBranchIcon size={18} className="text-primary" />
            Create Branch
          </DialogTitle>
          <DialogDescription className="text-ui-sm">
            Create a new branch from <span className="font-mono font-medium">{currentBranch}</span>.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={branchName}
          onChange={(e) => onBranchNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              onOpenChange(false);
              onBranchNameChange("");
            }
          }}
          placeholder="Branch name"
          className="text-ui-sm"
          autoFocus
        />
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onBranchNameChange("");
            }}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!branchName.trim() || actionBusy === "create-branch"}
            onClick={submit}
          >
            {actionBusy === "create-branch" ? (
              <>
                <Spinner size={12} className="animate-spin mr-1" />
                Creating…
              </>
            ) : (
              "Create & checkout"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
