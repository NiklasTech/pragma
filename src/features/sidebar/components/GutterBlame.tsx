import { useGitStore } from "@/shared/stores/git";
import "./blameGutter";
import { GitCommitDetailsDialog } from "./GitCommitDetailsDialog";

export function GutterBlame() {
  const selectedSha = useGitStore((state) => state.blameSelectedSha);
  const setSelectedSha = useGitStore((state) => state.setBlameSelectedSha);

  return (
    <GitCommitDetailsDialog
      sha={selectedSha}
      open={selectedSha !== null}
      onOpenChange={(open) => {
        if (!open) setSelectedSha(null);
      }}
    />
  );
}
