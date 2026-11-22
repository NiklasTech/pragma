import { FolderSimpleDashed, Spinner, Warning } from "@phosphor-icons/react";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";

export function GitErrorAlert({ error }: { error: string }) {
  return (
    <Alert variant="destructive" className="m-2 mb-0">
      <Warning size={16} />
      <AlertTitle>Git error</AlertTitle>
      <AlertDescription className="text-ui-base">{error}</AlertDescription>
    </Alert>
  );
}

export function ActionStatusBanner({ status }: { status: string }) {
  return (
    <div className="flex animate-pulse items-center gap-1 px-3 py-1 text-ui-xs text-fg-muted">
      <Spinner size={10} className="animate-spin" />
      <span className="max-w-[180px] truncate">{status}</span>
    </div>
  );
}

/// Shown when a folder full of untracked files, such as build output, was left out of the list.
export function UntrackedOmittedBanner({ count }: { count: number }) {
  return (
    <Alert className="m-2 mb-0">
      <FolderSimpleDashed size={16} />
      <AlertTitle>{count.toLocaleString("en-US")} more untracked files not listed</AlertTitle>
      <AlertDescription className="text-ui-sm">
        Stage all leaves them out. Build output or dependencies? Add the folder to .gitignore and
        Git stays fast.
      </AlertDescription>
    </Alert>
  );
}
