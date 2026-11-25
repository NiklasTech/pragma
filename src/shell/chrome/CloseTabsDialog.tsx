import { Warning } from "@phosphor-icons/react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

import { closeTabsNow, useCloseTabsRequestStore } from "./closeSpaceTabs";

/// Asks before tabs close while an agent or a program still works in them.
export function CloseTabsDialog() {
  const request = useCloseTabsRequestStore((state) => state.request);
  const busy = request?.busy ?? [];
  const tabs = request?.tabIds.length ?? 0;
  const dismiss = () => useCloseTabsRequestStore.setState({ request: null });

  const confirm = () => {
    if (!request) return;
    dismiss();
    closeTabsNow(request.spaceId, request.tabIds);
  };

  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => !open && dismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Warning size={20} className="text-status-warning" />
          </AlertDialogMedia>
          <AlertDialogTitle>{tabs === 1 ? "Close tab?" : `Close ${tabs} tabs?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {busy.length === 1
              ? `${busy[0]} is still working. Closing stops it.`
              : `${busy.length} sessions are still working. Closing stops them.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            Stop and Close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
