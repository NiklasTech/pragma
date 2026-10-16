"use client";

import { FolderSimple } from "@phosphor-icons/react";

import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";

/// The repository a pane's session works in, shown once several repositories are open.
export function PaneRepositoryLabel({ rootPath }: { rootPath: string | null }) {
  const several = useOpenRepositoriesStore((state) => state.paths.length > 1);
  if (!several || !rootPath) return null;

  return (
    <span
      className="flex min-w-0 shrink items-center gap-1 text-ui-2xs text-fg-subtle @max-[320px]/pane-header:hidden"
      title={rootPath}
    >
      <FolderSimple size={11} className="shrink-0" />
      <RepositoryColorDot path={rootPath} className="size-1.5" />
      <span className="truncate">{getWorkspaceName(rootPath)}</span>
    </span>
  );
}
