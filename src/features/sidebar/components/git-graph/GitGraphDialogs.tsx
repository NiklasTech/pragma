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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { GitCommitDetailsDialog } from "../GitCommitDetailsDialog";
import type { ConfirmDialogState } from "./types";

export function GitGraphDialogs({
  detailsSha,
  onCloseDetails,
  branchDialogSha,
  branchNameInput,
  onBranchNameChange,
  onCloseBranchDialog,
  onCreateBranch,
  confirmDialog,
  onCloseConfirm,
  onConfirm,
}: {
  detailsSha: string | null;
  onCloseDetails: () => void;
  branchDialogSha: string | null;
  branchNameInput: string;
  onBranchNameChange: (value: string) => void;
  onCloseBranchDialog: () => void;
  onCreateBranch: () => void;
  confirmDialog: ConfirmDialogState | null;
  onCloseConfirm: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <GitCommitDetailsDialog
        sha={detailsSha}
        open={!!detailsSha}
        onOpenChange={(open) => {
          if (!open) onCloseDetails();
        }}
      />

      <Dialog open={!!branchDialogSha} onOpenChange={(open) => !open && onCloseBranchDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create branch from {branchDialogSha?.slice(0, 7)}</DialogTitle>
            <DialogDescription>
              Enter a name for the new branch. It will be created at this commit and checked out.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={branchNameInput}
            onChange={(e) => onBranchNameChange(e.target.value)}
            placeholder="branch-name"
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateBranch();
              if (e.key === "Escape") onCloseBranchDialog();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={onCloseBranchDialog}>
              Cancel
            </Button>
            <Button onClick={onCreateBranch} disabled={!branchNameInput.trim()}>
              Create & checkout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && onCloseConfirm()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCloseConfirm}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirm}
              className={
                confirmDialog?.type === "reset-hard" ? "bg-destructive text-white" : undefined
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
