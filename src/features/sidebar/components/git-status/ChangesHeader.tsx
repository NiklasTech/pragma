import { useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowsClockwise,
  CaretDown,
  CloudArrowDown,
  DotsThree,
  GitBranch,
  GitDiff,
  Tag,
} from "@phosphor-icons/react";

import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { IconButton } from "@/shared/components/ui/icon-button";
import { selectRootFolder } from "@/shared/hooks/useFileExplorer";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useGitStore } from "@/shared/stores/git";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useRepositoryGitStore } from "@/shared/stores/repositoryGit";

import { useRepositoryGitSync } from "../../hooks/useRepositoryGitSync";
import { summarizeGitRepositories } from "../../lib/gitRepositories";

/// The open repository as a chip; with several open, a menu switches between them.
function RepositorySwitcher() {
  useRepositoryGitSync();
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const activeRoot = useFileExplorerStore((state) => state.rootPath);
  const activeSnapshot = useGitStore((state) => state.snapshot);
  const byRoot = useRepositoryGitStore((state) => state.byRoot);
  const summaries = useMemo(
    () => summarizeGitRepositories(paths, activeRoot, activeSnapshot, byRoot),
    [paths, activeRoot, activeSnapshot, byRoot],
  );
  const active = summaries.find((summary) => summary.active);
  if (!active) return null;

  const chip = (
    <>
      <RepositoryColorDot path={active.path} />
      <span className="truncate">{active.name}</span>
    </>
  );
  if (summaries.length < 2) {
    return (
      <span
        title={active.path}
        className="flex h-6.5 min-w-0 items-center gap-1.5 px-1 font-mono text-ui-xs text-fg-default"
      >
        {chip}
      </span>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            title={active.path}
            className="min-w-0 max-w-36 gap-1.5 px-2"
          >
            {chip}
            <CaretDown size={10} className="shrink-0 text-fg-subtle" />
          </Button>
        }
      />
      <DropdownMenuContent className="w-60">
        {summaries.map((summary) => (
          <DropdownMenuItem
            key={summary.path}
            onClick={() => {
              if (!summary.active) void selectRootFolder(summary.path);
            }}
          >
            <RepositoryColorDot path={summary.path} />
            <span className="truncate">{summary.name}</span>
            {summary.branch && (
              <span className="truncate font-mono text-ui-2xs text-fg-subtle">
                {summary.branch}
              </span>
            )}
            {summary.changes > 0 && (
              <span className="ml-auto font-mono text-ui-2xs text-fg-muted tabular-nums">
                {summary.changes}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/// One line on top of Changes: repository, branch, and how far it is ahead or behind its remote.
export function ChangesHeader({
  branch,
  ahead,
  behind,
  canPushPull,
  busy,
  onPull,
  onPush,
  onFetch,
  onRefresh,
  onNewBranch,
  onTags,
  onCompare,
}: {
  branch: React.ReactNode;
  ahead: number;
  behind: number;
  canPushPull: boolean;
  busy: string | null;
  onPull: () => void;
  onPush: () => void;
  onFetch: () => void;
  onRefresh: () => void;
  onNewBranch: () => void;
  onTags: () => void;
  onCompare: () => void;
}) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5 px-2.5 pt-2.5 pb-2">
      <RepositorySwitcher />
      {branch}
      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        {canPushPull && (
          <span
            title={`${ahead} to push, ${behind} to pull`}
            className="mr-1 font-mono text-[11px] text-fg-subtle tabular-nums"
          >
            <span className={ahead > 0 ? "text-primary" : undefined}>↑{ahead}</span>{" "}
            <span className={behind > 0 ? "text-primary" : undefined}>↓{behind}</span>
          </span>
        )}
        <IconButton
          icon={ArrowDown}
          label="Pull"
          size="sm"
          disabled={!canPushPull || behind === 0 || busy !== null}
          onClick={onPull}
        />
        <IconButton
          icon={ArrowUp}
          label="Push"
          size="sm"
          disabled={!canPushPull || ahead === 0 || busy !== null}
          onClick={onPush}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<IconButton icon={DotsThree} label="More git actions" size="sm" />}
          />
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled={!canPushPull || busy !== null} onClick={onFetch}>
              <CloudArrowDown size={14} />
              Fetch
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRefresh}>
              <ArrowsClockwise size={14} />
              Refresh status
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onNewBranch}>
              <GitBranch size={14} />
              New branch
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCompare}>
              <GitDiff size={14} />
              Compare
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTags}>
              <Tag size={14} />
              Tags
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}
