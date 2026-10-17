import { useMemo } from "react";
import { ArrowsLeftRight, CaretRight, FolderSimple, GitBranch, X } from "@phosphor-icons/react";

import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import { useFileExplorer } from "@/shared/hooks/useFileExplorer";
import { useCloseRepository } from "@/shared/hooks/useOpenRepositories";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useRepositoryGitStore } from "@/shared/stores/repositoryGit";

import { useRepositoryGitSync } from "../../hooks/useRepositoryGitSync";
import { summarizeGitRepositories, type GitRepositorySummary } from "../../lib/gitRepositories";
import { RepositoryChangesDetails } from "./RepositoryChangesDetails";
import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";

function RepositoryLine({ summary }: { summary: GitRepositorySummary }) {
  return (
    <>
      <FolderSimple
        size={13}
        weight={summary.active ? "fill" : "regular"}
        className={summary.active ? "shrink-0 text-primary" : "shrink-0 text-fg-subtle"}
      />
      <RepositoryColorDot path={summary.path} />
      <span className="min-w-0 truncate font-medium text-fg-default">{summary.name}</span>
      {summary.branch && (
        <span className="hidden min-w-0 items-center gap-0.5 truncate text-fg-subtle @min-[260px]:flex">
          <GitBranch size={11} className="shrink-0" />
          <span className="truncate">{summary.branch}</span>
        </span>
      )}
      <span className="flex-1" />
      {summary.active && (
        <span className="hidden shrink-0 text-ui-2xs text-fg-subtle @min-[300px]:inline">
          active
        </span>
      )}
      {summary.changes > 0 && (
        <Badge variant="secondary" className="shrink-0 tabular-nums">
          {summary.changes}
        </Badge>
      )}
    </>
  );
}

function RepositoryActions({ summary }: { summary: GitRepositorySummary }) {
  const { selectRoot } = useFileExplorer();
  const closeRepository = useCloseRepository();

  return (
    <div className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/repo:opacity-100 group-hover/repo:opacity-100">
      {!summary.active && (
        <Button
          variant="ghost"
          size="icon-xs"
          title="Make active"
          aria-label={`Make ${summary.name} the active repository`}
          onClick={() => void selectRoot(summary.path)}
        >
          <ArrowsLeftRight size={12} />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        title="Close repository"
        aria-label={`Close ${summary.name}`}
        onClick={() => void closeRepository(summary.path)}
      >
        <X size={12} />
      </Button>
    </div>
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
            className="group/repo flex h-7 items-center gap-1.5 pr-1 pl-3 text-ui-xs"
          >
            <span className="w-3 shrink-0" />
            <RepositoryLine summary={summary} />
            <RepositoryActions summary={summary} />
          </div>
        ) : (
          <Collapsible key={summary.path}>
            <div className="group/repo flex h-7 items-center pr-1 hover:bg-bg-hover">
              <CollapsibleTrigger
                title={summary.path}
                className="group flex h-full min-w-0 flex-1 items-center gap-1.5 pl-3 text-left text-ui-xs"
              >
                <CaretRight
                  size={12}
                  className="shrink-0 text-fg-subtle transition-transform group-data-[panel-open]:rotate-90"
                />
                <RepositoryLine summary={summary} />
              </CollapsibleTrigger>
              <RepositoryActions summary={summary} />
            </div>
            <CollapsibleContent>
              <RepositoryChangesDetails rootPath={summary.path} />
            </CollapsibleContent>
          </Collapsible>
        ),
      )}
    </section>
  );
}
