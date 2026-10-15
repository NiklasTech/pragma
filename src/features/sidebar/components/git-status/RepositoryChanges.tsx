import { useMemo } from "react";
import { CaretRight, FolderSimple, GitBranch } from "@phosphor-icons/react";

import { Badge } from "@/shared/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useRepositoryGitStore } from "@/shared/stores/repositoryGit";

import { useRepositoryGitSync } from "../../hooks/useRepositoryGitSync";
import { summarizeGitRepositories, type GitRepositorySummary } from "../../lib/gitRepositories";
import { RepositoryChangesDetails } from "./RepositoryChangesDetails";

function RepositoryLine({ summary }: { summary: GitRepositorySummary }) {
  return (
    <>
      <FolderSimple
        size={13}
        weight={summary.active ? "fill" : "regular"}
        className={summary.active ? "shrink-0 text-primary" : "shrink-0 text-fg-subtle"}
      />
      <span className="min-w-0 truncate font-medium text-fg-default">{summary.name}</span>
      {summary.branch && (
        <span className="flex min-w-0 items-center gap-0.5 truncate text-fg-subtle">
          <GitBranch size={11} className="shrink-0" />
          <span className="truncate">{summary.branch}</span>
        </span>
      )}
      <span className="flex-1" />
      {summary.active && <span className="shrink-0 text-ui-2xs text-fg-subtle">active</span>}
      {summary.changes > 0 && (
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {summary.changes}
        </Badge>
      )}
    </>
  );
}

/// The open repositories with their branch and number of changes; others expand to stage and commit.
export function RepositoryChanges() {
  useRepositoryGitSync();
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const activeRoot = useFileExplorerStore((state) => state.rootPath);
  const activeSnapshot = useGitStore((state) => state.snapshot);
  const byRoot = useRepositoryGitStore((state) => state.byRoot);

  const summaries = useMemo(
    () => summarizeGitRepositories(paths, activeRoot, activeSnapshot, byRoot),
    [paths, activeRoot, activeSnapshot, byRoot],
  );

  if (summaries.length < 2) return null;

  return (
    <section
      aria-label="Repositories"
      className="flex shrink-0 flex-col border-b border-border-subtle py-1"
    >
      {summaries.map((summary) =>
        summary.active ? (
          <div
            key={summary.path}
            title={summary.path}
            className="flex h-7 items-center gap-1.5 px-3 text-ui-xs"
          >
            <span className="w-3 shrink-0" />
            <RepositoryLine summary={summary} />
          </div>
        ) : (
          <Collapsible key={summary.path}>
            <CollapsibleTrigger
              title={summary.path}
              className="group flex h-7 w-full items-center gap-1.5 px-3 text-left text-ui-xs hover:bg-bg-hover"
            >
              <CaretRight
                size={12}
                className="shrink-0 text-fg-subtle transition-transform group-data-[panel-open]:rotate-90"
              />
              <RepositoryLine summary={summary} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <RepositoryChangesDetails rootPath={summary.path} />
            </CollapsibleContent>
          </Collapsible>
        ),
      )}
    </section>
  );
}
