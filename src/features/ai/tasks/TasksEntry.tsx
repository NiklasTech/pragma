"use client";

import { Kanban } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

import { useTasksStore } from "./store";
import { useTasksUiStore } from "./ui";

export function TasksEntry() {
  const openCount = useTasksStore(
    (state) => state.tasks.filter((task) => task.status !== "done").length,
  );
  const boardOpen = useTasksUiStore((state) => state.boardOpen);
  const openBoard = useTasksUiStore((state) => state.openBoard);

  return (
    <button
      type="button"
      onClick={openBoard}
      aria-current={boardOpen ? "page" : undefined}
      className={cn(
        "group flex h-8 w-full items-center gap-2 rounded-lg px-3.5 text-ui-sm transition-colors",
        boardOpen
          ? "bg-bg-root font-medium text-fg-default shadow-[var(--shadow-sm)] ring-1 ring-border-subtle"
          : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
      )}
    >
      <Kanban
        size={14}
        weight={boardOpen ? "fill" : "regular"}
        className="text-status-warning transition-transform group-hover:scale-110"
      />
      Tasks
      {openCount > 0 && (
        <span className="ml-auto rounded-full bg-status-warning/12 px-1.5 text-ui-2xs font-medium text-status-warning tabular-nums">
          {openCount}
        </span>
      )}
    </button>
  );
}
