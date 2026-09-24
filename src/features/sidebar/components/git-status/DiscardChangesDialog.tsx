import { Trash } from "@phosphor-icons/react";
import { type GitStatusEntry } from "@/shared/stores/git";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";

export function DiscardChangesDialog({
  entry,
  onCancel,
  onConfirm,
}: {
  entry: GitStatusEntry | null;
  onCancel: () => void;
  onConfirm: (entry: GitStatusEntry) => void;
}) {
  return (
    <Dialog open={!!entry} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ui-md">
            <Trash size={18} className="text-status-error" />
            Discard Changes
          </DialogTitle>
          <DialogDescription className="text-ui-sm">
            Are you sure you want to discard all changes in{" "}
            <span className="font-mono font-medium">{entry?.path}</span>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={() => entry && onConfirm(entry)}>
            Discard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
