import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Warning } from "@phosphor-icons/react";

interface PushPullErrorDialogProps {
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
}

export function PushPullErrorDialog({ error, onOpenChange, onDismiss }: PushPullErrorDialogProps) {
  return (
    <Dialog open={!!error} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-ui-md">
            <Warning size={18} className="text-status-error" />
            Git Remote Error
          </DialogTitle>
          <DialogDescription className="text-ui-sm">{error}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onDismiss} className="text-ui-sm">
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
