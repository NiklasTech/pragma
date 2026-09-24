import { Spinner, Warning } from "@phosphor-icons/react";
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
