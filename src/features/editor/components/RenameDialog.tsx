import { useEffect, useState } from "react";

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
import { executeRename, useRenameDialogStore } from "@/features/editor/lsp/rename";

export function RenameDialog() {
  const request = useRenameDialogStore((state) => state.request);
  const closeDialog = useRenameDialogStore((state) => state.closeDialog);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (request) {
      setName(request.currentName);
    }
  }, [request]);

  const submit = async () => {
    if (!request || busy) {
      return;
    }
    setBusy(true);
    const renamed = await executeRename(request, name);
    setBusy(false);
    if (renamed) {
      closeDialog();
    }
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename Symbol</DialogTitle>
          <DialogDescription>
            Rename {request ? `"${request.currentName}"` : "symbol"} and all its references.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.target.select()}
            placeholder="New name"
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || name.trim().length === 0}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
