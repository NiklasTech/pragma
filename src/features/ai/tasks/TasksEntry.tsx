"use client";

import { Kanban } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { repositoryTasks, useTasksStore } from "./store";
import { useTasksUiStore } from "./ui";

export function TasksEntry() {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const openCount = useTasksStore(
    (state) =>
      repositoryTasks(state.byRoot, rootPath).tasks.filter((task) => task.status !== "done").length,
  );
  const boardOpen = useTasksUiStore((state) => state.boardOpen);
  const openBoard = useTasksUiStore((state) => state.openBoard);

  return (
    <Button
      variant="ghost"
      onClick={() => openBoard()}
      aria-current={boardOpen ? "page" : undefined}
      className={cn(
        "group h-8 w-full justify-start gap-2 px-3.5 font-normal",
        boardOpen && "bg-bg-active font-medium text-fg-default",
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
    </Button>
  );
}
