import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Cube } from "@phosphor-icons/react";

interface ComposeRebuildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (rebuild: boolean) => void;
}

export function ComposeRebuildDialog({ open, onOpenChange, onConfirm }: ComposeRebuildDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ui-md">
            <Cube size={18} className="text-primary" />
            Compose changed — rebuild?
          </DialogTitle>
          <DialogDescription className="text-ui-sm">
            docker-compose.yml differs between branches. Rebuild containers now?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConfirm(false)}
            className="text-ui-sm"
          >
            No
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onConfirm(true)}
            className="text-ui-sm"
          >
            Yes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
