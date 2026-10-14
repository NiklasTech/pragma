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
import { useCloseRepositoryNow } from "@/shared/hooks/useOpenRepositories";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import {
  stopSessions,
  useCloseRepositoryRequestStore,
} from "@/features/ai/sessions/runningSessions";

export function CloseRepositoryDialog() {
  const request = useCloseRepositoryRequestStore((state) => state.request);
  const closeNow = useCloseRepositoryNow();
  const count = request?.sessionIds.length ?? 0;

  const dismiss = () => useCloseRepositoryRequestStore.setState({ request: null });

  const confirm = () => {
    if (!request) return;
    dismiss();
    stopSessions(request.sessionIds);
    void closeNow(request.path);
  };

  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => !open && dismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Warning size={20} className="text-status-warning" />
          </AlertDialogMedia>
          <AlertDialogTitle>Close repository?</AlertDialogTitle>
          <AlertDialogDescription>
            {`${count} ${count === 1 ? "session is" : "sessions are"} still running in ${getWorkspaceName(request?.path ?? null)}. Closing the repository stops ${count === 1 ? "it" : "them"}.`}
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
