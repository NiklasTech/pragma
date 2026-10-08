import { GitMerge } from "@phosphor-icons/react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useGitStore } from "@/shared/stores/git";

export function OperationBanner({ conflictCount }: { conflictCount: number }) {
  const operation = useGitStore((s) => s.operation);
  const actionBusy = useGitStore((s) => s.actionBusy);
  const continueOperation = useGitStore((s) => s.continueOperation);
  const abortOperation = useGitStore((s) => s.abortOperation);

  if (!operation) return null;

  const kind = operation === "rebase" ? "Rebase" : "Merge";
  const busy = actionBusy !== null;

  return (
    <Alert variant="warning" className="mx-2.5 mb-2 w-auto">
      <GitMerge size={16} />
      <AlertTitle>{kind} in progress</AlertTitle>
      <AlertDescription className="text-ui-xs">
        {conflictCount > 0
          ? `Resolve ${conflictCount} conflicted file${conflictCount === 1 ? "" : "s"}, then continue.`
          : "All conflicts are resolved. Continue to finish."}
      </AlertDescription>
      <div className="col-start-2 mt-1.5 flex gap-1.5">
        <Button
          size="sm"
          disabled={busy || conflictCount > 0}
          onClick={() => void continueOperation()}
        >
          Continue
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => void abortOperation()}
        >
          Abort
        </Button>
      </div>
    </Alert>
  );
}
