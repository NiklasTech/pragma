import { CaretDown } from "@phosphor-icons/react";

import { PragmaMark } from "@/shared/components/PragmaMark";
import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";
import { Button } from "@/shared/components/ui/button";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useOverlayStore } from "@/shared/stores/overlays";

/// The active space's name in the strip; opens the spaces overlay.
export function SpaceButton() {
  const rootPath = useFileExplorerStore((s) => s.rootPath);
  const activeRepository = useOpenRepositoriesStore((s) => s.activePath);
  const branch = useGitStore((s) => s.snapshot?.repo.branch ?? null);
  const toggle = useOverlayStore((s) => s.toggle);
  const workspaceName = getWorkspaceName(rootPath);

  return (
    <Button
      variant="ghost"
      aria-label={`Spaces, current: ${workspaceName || "none"}`}
      aria-haspopup="dialog"
      title={branch ? `${rootPath} (${branch})` : (rootPath ?? "Open a folder")}
      className="max-w-[320px] min-w-0 justify-start pr-2 pl-1.5 font-semibold text-fg-default"
      onClick={() => toggle("spaces")}
    >
      {workspaceName ? (
        <span
          aria-hidden="true"
          className="flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-bg-active text-[11px] text-fg-muted"
        >
          {workspaceName.charAt(0).toUpperCase()}
        </span>
      ) : (
        <PragmaMark variant="compact" className="size-4 shrink-0 text-fg-default" />
      )}
      <RepositoryColorDot path={activeRepository} />
      <span className="min-w-0 truncate">{workspaceName || "Open Folder"}</span>
      {workspaceName && branch && (
        <span className="max-w-[120px] min-w-0 truncate text-ui-2xs font-normal text-fg-subtle">
          {branch}
        </span>
      )}
      <CaretDown size={12} className="shrink-0 text-fg-subtle" />
    </Button>
  );
}
