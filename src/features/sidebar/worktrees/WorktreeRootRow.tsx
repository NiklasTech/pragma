import { CaretDown, GitBranch } from "@phosphor-icons/react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { AGENT_STATE_LABELS, StatusDot } from "@/shared/components/ui/status-dot";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { cn } from "@/shared/lib/utils";
import { useWorktreeAgent } from "./useWorktreeAgent";
import { useWorktreeViewStore, type RepositoryWorktree } from "./worktreeView";

function changedLabel(count: number): string {
  return count === 0 ? "" : `${count} changed`;
}

function WorktreeItem({
  worktree,
  current,
  onSelect,
}: {
  worktree: RepositoryWorktree;
  current: boolean;
  onSelect: () => void;
}) {
  const { manifest, name, state } = useWorktreeAgent(worktree.sessionId);
  return (
    <DropdownMenuItem
      onClick={onSelect}
      className={cn("min-h-10 gap-2.5", current && "bg-bg-hover")}
    >
      <AgentMark agentId={manifest?.id} name={name} size="sm" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-ui-xs text-fg-default">
          {worktree.environment.branch}
        </span>
        <span className="text-ui-2xs text-fg-subtle">
          {worktree.sessionId
            ? `${name} · ${AGENT_STATE_LABELS[state].toLowerCase()}`
            : "No session"}
        </span>
      </span>
      {worktree.sessionId && <StatusDot state={state} decorative className="ml-auto" />}
    </DropdownMenuItem>
  );
}

interface WorktreeRootRowProps {
  rootPath: string;
  /** The branch the repository's own folder has checked out. */
  branch: string | null;
  worktrees: RepositoryWorktree[];
  shown: RepositoryWorktree | null;
  /** Changed files in the folder the tree shows. */
  changed: number;
  /** Changed files in the repository's own folder, for its menu entry. */
  mainChanged: number;
}

/// The repository's name over its tree, with a switch to the worktrees agents work in.
export function WorktreeRootRow({
  rootPath,
  branch,
  worktrees,
  shown,
  changed,
  mainChanged,
}: WorktreeRootRowProps) {
  const show = useWorktreeViewStore((state) => state.show);
  const shownAgent = useWorktreeAgent(shown?.sessionId ?? null);
  const name = getWorkspaceName(rootPath);
  const label = shown ? shown.environment.branch : (branch ?? "main");

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 pr-2 pl-3.5">
      <span
        className="max-w-[40%] shrink-0 truncate text-ui-sm font-semibold text-fg-default"
        title={rootPath}
      >
        {name}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Worktree: ${label}. Switch worktree`}
              className="h-6 min-w-0 shrink gap-1.5 rounded-[6px] bg-bg-hover px-1.5 font-mono text-ui-2xs font-normal text-fg-muted hover:text-fg-default"
            />
          }
        >
          {shown ? (
            <AgentMark agentId={shownAgent.manifest?.id} name={shownAgent.name} size="sm" />
          ) : (
            <GitBranch size={12} aria-hidden="true" />
          )}
          <span className="min-w-0 truncate">{label}</span>
          <CaretDown size={10} aria-hidden="true" className="shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Worktrees of {name}</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => show(rootPath, null)}
              className={cn("min-h-10 gap-2.5", !shown && "bg-bg-hover")}
            >
              <GitBranch size={14} aria-hidden="true" className="shrink-0 text-fg-muted" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-ui-xs text-fg-default">
                  {branch ?? "main"}
                </span>
                <span className="text-ui-2xs text-fg-subtle">This folder · you</span>
              </span>
              {mainChanged > 0 && (
                <span className="ml-auto shrink-0 font-mono text-ui-2xs text-git-modified">
                  {changedLabel(mainChanged)}
                </span>
              )}
            </DropdownMenuItem>
            {worktrees.map((worktree) => (
              <WorktreeItem
                key={worktree.environment.id}
                worktree={worktree}
                current={shown?.environment.id === worktree.environment.id}
                onSelect={() => show(rootPath, worktree.environment.id)}
              />
            ))}
            {worktrees.length === 0 && (
              <p className="px-2 pt-1 pb-2 text-ui-xs text-fg-subtle">
                Agents started in their own worktree show up here.
              </p>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="shrink-0 text-ui-xs text-fg-subtle">{changedLabel(changed)}</span>
    </div>
  );
}
