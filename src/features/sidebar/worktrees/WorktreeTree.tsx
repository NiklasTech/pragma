import { useMemo } from "react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { useDelayedLoading } from "@/shared/hooks/useDelayedLoading";
import { getVisibleNodes } from "@/shared/stores/fileExplorer";
import { buildGitDecorations } from "@/features/sidebar/lib/gitDecorations";
import { filterWorkspaceFiles } from "@/features/sidebar/lib/treeFilter";
import { useWorkspaceFileList } from "@/features/sidebar/hooks/useWorkspaceFileList";

import { FileTreeRows } from "../components/FileTreeRows";
import { useWorktreeAgent } from "./useWorktreeAgent";
import { useWorktreeFiles } from "./useWorktreeFiles";
import { WorktreeRootRow } from "./WorktreeRootRow";
import type { RepositoryWorktree } from "./worktreeView";

interface WorktreeTreeProps {
  rootPath: string;
  branch: string | null;
  worktrees: RepositoryWorktree[];
  worktree: RepositoryWorktree;
  mainChanged: number;
  filter: string;
}

/// The files of an agent's worktree, with the agent's mark on what changed there.
export function WorktreeTree({
  rootPath,
  branch,
  worktrees,
  worktree,
  mainChanged,
  filter,
}: WorktreeTreeProps) {
  const path = worktree.environment.path;
  const { tree, expandedDirs, toggleDir, snapshot } = useWorktreeFiles(path);
  const { manifest, name, state } = useWorktreeAgent(worktree.sessionId);
  const decorations = useMemo(() => buildGitDecorations(snapshot), [snapshot]);

  const filtering = filter.trim() !== "";
  const files = useWorkspaceFileList(path, filtering);
  const nodes = useMemo(
    () =>
      filtering
        ? filterWorkspaceFiles(path, files ?? [], filter)
        : getVisibleNodes(tree, expandedDirs),
    [filtering, path, files, filter, tree, expandedDirs],
  );
  const shownOpen = useMemo(
    () =>
      filtering
        ? new Set(nodes.filter((item) => item.node.isDirectory).map((item) => item.node.path))
        : expandedDirs,
    [filtering, nodes, expandedDirs],
  );
  const loading = useDelayedLoading(tree.length === 0 && snapshot === null);

  const owner = worktree.sessionId ? name : null;
  return (
    <>
      <WorktreeRootRow
        rootPath={rootPath}
        branch={branch}
        worktrees={worktrees}
        shown={worktree}
        changed={snapshot?.changed_files.length ?? 0}
        mainChanged={mainChanged}
      />
      <p className="mx-2.5 mb-1.5 flex shrink-0 items-start gap-2 rounded-[8px] bg-bg-hover px-2.5 py-2 text-ui-xs leading-relaxed text-fg-muted">
        {owner && <AgentMark agentId={manifest?.id} name={owner} size="sm" className="mt-0.5" />}
        <span>
          {owner
            ? state === "working"
              ? `${owner} is working in this worktree. `
              : `${owner} works in this worktree. `
            : ""}
          Anything you edit here lands on{" "}
          <span className="font-mono text-fg-default">{worktree.environment.branch}</span>.
        </span>
      </p>
      <FileTreeRows
        nodes={nodes}
        expandedDirs={shownOpen}
        onToggleDir={toggleDir}
        decorations={decorations}
        dropRoot={path}
        loading={loading}
        emptyText={
          filtering ? (files === null ? "Searching…" : "No file matches.") : "Empty folder"
        }
        changeMark={owner ? <AgentMark agentId={manifest?.id} name={owner} size="sm" /> : undefined}
      />
    </>
  );
}
