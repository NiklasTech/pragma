import { ArrowCounterClockwise, Warning } from "@phosphor-icons/react";
import { type GitLastCommit } from "@/shared/stores/git";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

export function UndoCommitDialog({
  commit,
  onCancel,
  onConfirm,
}: {
  commit: GitLastCommit | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const subject = commit?.message.split("\n")[0] ?? "";

  return (
    <Dialog open={!!commit} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ui-md">
            <ArrowCounterClockwise size={18} />
            Undo Last Commit
          </DialogTitle>
          <DialogDescription className="text-ui-sm">
            Undo <span className="font-mono font-medium">{subject}</span>? Its changes stay staged.
          </DialogDescription>
        </DialogHeader>
        {commit?.is_pushed && (
          <p className="flex items-start gap-2 text-ui-sm text-status-warning">
            <Warning size={16} className="mt-0.5 shrink-0" />
            This commit is already pushed. Undoing it rewrites history, and the next push needs a
            force push.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={commit?.is_pushed ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
          >
            Undo Commit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
