import { Spinner, GitBranch as GitBranchIcon, Warning } from "@phosphor-icons/react";
import { PanelEmptyState } from "@/shared/components/PanelEmptyState";

export function OpenFolderState() {
  return (
    <PanelEmptyState
      icon={GitBranchIcon}
      title="Open a folder"
      description="Open a folder with a Git repository to view status and commit changes."
    />
  );
}

export function GitStatusLoadingState() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner size={20} className="animate-spin text-fg-muted" />
    </div>
  );
}

export function GitStatusErrorState({ error }: { error: string }) {
  return <PanelEmptyState icon={Warning} title="Git status unavailable" description={error} />;
}
