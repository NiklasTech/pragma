import { GitBranch, Info, Spinner, Warning } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";

export function NoRepositoryState() {
  return (
    <PanelEmptyState
      icon={GitBranch}
      title="Open a folder"
      description="Open a folder with a Git repository to view commit history."
    />
  );
}

export function LoadingCommitsState() {
  return (
    <div className="flex h-full items-center justify-center gap-2 text-ui-xs text-fg-muted">
      <Spinner size={16} className="animate-spin" />
      Loading commits…
    </div>
  );
}

export function LoadErrorState({ error }: { error: string | null }) {
  return (
    <PanelEmptyState icon={Info} title="Could not load history">
      <Alert variant="destructive" className="w-full text-left">
        <Warning size={16} />
        <AlertDescription className="text-ui-base">{error ?? "Unknown error"}</AlertDescription>
      </Alert>
    </PanelEmptyState>
  );
}

export function NoCommitsState() {
  return (
    <PanelEmptyState
      icon={GitBranch}
      title="No commits yet"
      description="This branch has no commits."
    />
  );
}
