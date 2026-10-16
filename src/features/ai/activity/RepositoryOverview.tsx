"use client";

import { useMemo } from "react";
import { FolderSimple } from "@phosphor-icons/react";

import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";

import { ACTIVE_TASK_STATUSES, countActiveTasks, type ActiveTaskStatus } from "../tasks/counts";
import { repositoryTasks, useTasksStore } from "../tasks/store";

import {
  needsAttention,
  REPOSITORY_STATES,
  summarizeRepositories,
  type RepositoryState,
  type RepositorySummary,
} from "./repositories";
import { showRepositoryTasks } from "./showRepositoryTasks";
import { useActivityStore } from "./store";
import { useShowRepository } from "./useShowRepository";
import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";

const STATE_BADGES: Record<RepositoryState, "warning" | "default" | "destructive" | "success"> = {
  waiting: "warning",
  working: "default",
  failed: "destructive",
  finished: "success",
};

const TASK_LABELS: Record<ActiveTaskStatus, string> = {
  in_progress: "in progress",
  in_review: "in review",
};

interface EntryProps {
  summary: RepositorySummary;
  tasks: Record<ActiveTaskStatus, number>;
  active: boolean;
  variant: "compact" | "full";
  onShow: (summary: RepositorySummary, sessionIds?: string[]) => void;
}

function RepositoryEntry({ summary, tasks, active, variant, onShow }: EntryProps) {
  const attention = needsAttention(summary);
  const states = REPOSITORY_STATES.filter((state) => summary.sessions[state].length > 0);
  const taskStatuses = ACTIVE_TASK_STATUSES.filter((status) => tasks[status] > 0);
  const hasBadges = states.length > 0 || taskStatuses.length > 0;
  const full = variant === "full";

  const content = (
    <>
      <button
        type="button"
        onClick={() => onShow(summary)}
        title={summary.path}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex min-w-0 items-center gap-1.5 rounded-md text-left",
          full ? "px-3" : "px-2 pt-1",
          !hasBadges && !full && "pb-1",
        )}
      >
        <FolderSimple
          size={full ? 15 : 13}
          weight={active ? "fill" : "regular"}
          className={cn("shrink-0", active ? "text-primary" : "text-fg-subtle")}
        />
        <RepositoryColorDot path={summary.path} />
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              "truncate font-medium text-fg-default",
              full ? "text-ui-sm" : "text-ui-xs",
            )}
          >
            {summary.name}
          </span>
          {full && <span className="truncate text-ui-2xs text-fg-subtle">{summary.path}</span>}
        </span>
        {attention && (
          <span
            role="img"
            aria-label="Needs your input"
            className="size-1.5 shrink-0 rounded-full bg-status-warning"
          />
        )}
      </button>
      {hasBadges && (
        <div className={cn("flex flex-wrap gap-1", full ? "px-3" : "pr-2 pb-1 pl-7")}>
          {states.map((state) => {
            const count = summary.sessions[state].length;
            return (
              <Badge
                key={state}
                variant={STATE_BADGES[state]}
                className="cursor-pointer tabular-nums"
                render={
                  <button
                    type="button"
                    title={`Open the ${state} sessions of ${summary.name}`}
                    onClick={() => onShow(summary, summary.sessions[state])}
                  />
                }
              >
                {count} {state}
              </Badge>
            );
          })}
          {taskStatuses.map((status) => {
            const count = tasks[status];
            return (
              <Badge
                key={status}
                variant="outline"
                className="cursor-pointer tabular-nums"
                render={
                  <button
                    type="button"
                    title={`Open the tasks of ${summary.name}`}
                    onClick={() => showRepositoryTasks(summary.path)}
                  />
                }
              >
                {count} {count === 1 ? "task" : "tasks"} {TASK_LABELS[status]}
              </Badge>
            );
          })}
        </div>
      )}
      {states.length === 0 && full && (
        <p className="px-3 text-ui-xs text-fg-subtle">No active agents</p>
      )}
    </>
  );

  if (full) {
    return (
      <Card
        size="sm"
        className={cn(
          "hover:border-border",
          active && "border-primary/40",
          attention && "border-status-warning/50",
        )}
      >
        {content}
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-md transition-colors hover:bg-bg-hover",
        active && "bg-bg-hover",
        attention && "ring-1 ring-status-warning/40 ring-inset",
      )}
    >
      {content}
    </div>
  );
}

/// The open repositories with how many of their sessions work, wait, failed or finished.
export function RepositoryOverview({ variant }: { variant: "compact" | "full" }) {
  const paths = useOpenRepositoriesStore((state) => state.paths);
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const entries = useActivityStore((state) => state.entries);
  const tasksByRoot = useTasksStore((state) => state.byRoot);
  const showRepository = useShowRepository();

  const summaries = useMemo(
    () => summarizeRepositories(paths, chatSessions, entries),
    [chatSessions, entries, paths],
  );

  if (summaries.length < 2) return null;

  const handleShow = (summary: RepositorySummary, sessionIds?: string[]) => {
    void showRepository(summary, sessionIds);
  };

  return (
    <section aria-label="Repositories" className="flex w-full flex-col gap-0.5">
      <h3
        className={cn(
          "px-2 pb-0.5 font-semibold tracking-wide text-fg-subtle uppercase",
          variant === "full" ? "text-ui-xs" : "text-ui-2xs",
        )}
      >
        Repositories
      </h3>
      <div className={variant === "full" ? "grid gap-2 sm:grid-cols-2" : "flex flex-col gap-0.5"}>
        {summaries.map((summary) => (
          <RepositoryEntry
            key={summary.path}
            summary={summary}
            tasks={countActiveTasks(repositoryTasks(tasksByRoot, summary.path).tasks)}
            active={summary.path === rootPath}
            variant={variant}
            onShow={handleShow}
          />
        ))}
      </div>
    </section>
  );
}
