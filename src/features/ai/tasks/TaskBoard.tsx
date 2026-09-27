"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useNamedAgentsStore } from "@/features/ai/named-agents/store";

import { resolveTaskActions } from "./actionState";
import { resumeTask, runTask, stopTask } from "./actions";
import { DeleteTaskDialog } from "./DeleteTaskDialog";
import { useSessionRunsStore } from "./sessionRuns";
import { useTasksStore } from "./store";
import { TASK_MIME, TaskCard } from "./TaskCard";
import { TaskDialog } from "./TaskDialog";
import type { Task, TaskStatus } from "./types";
import { useTasksUiStore } from "./ui";
import { TASK_COLUMNS } from "./validation";

export function TaskBoard() {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const tasks = useTasksStore((state) => state.tasks);
  const loaded = useTasksStore((state) => state.loaded);
  const loadFailed = useTasksStore((state) => state.loadFailed);
  const moveTask = useTasksStore((state) => state.moveTask);
  const deleteTask = useTasksStore((state) => state.deleteTask);
  const agents = useNamedAgentsStore((state) => state.agents);
  const chatSessions = useAIStore((state) => state.chatSessions);
  const liveSessionId = useSessionRunsStore((state) => state.liveSessionId);
  const closeBoard = useTasksUiStore((state) => state.closeBoard);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);

  const sessionIds = useMemo(
    () => new Set(chatSessions.map((session) => session.id)),
    [chatSessions],
  );

  const openDialog = (task: Task | null) => {
    setEditing(task);
    setDialogOpen(true);
  };

  const handleDrop = (status: TaskStatus, event: React.DragEvent<HTMLElement>) => {
    setDropTarget(null);
    const taskId = event.dataTransfer.getData(TASK_MIME);
    if (!taskId) return;
    event.preventDefault();
    void moveTask(taskId, status).catch(() => toast.error("Could not move the task"));
  };

  const handleConfirmDelete = () => {
    if (!toDelete) return;
    const taskId = toDelete.id;
    setToDelete(null);
    void deleteTask(taskId).catch(() => toast.error("Could not delete the task"));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-tab shrink-0 items-center gap-2 border-b border-border-subtle px-3">
        <h2 className="text-ui-sm font-semibold text-fg-default">Tasks</h2>
        {tasks.length > 0 && (
          <span className="text-ui-xs text-fg-subtle tabular-nums">{tasks.length}</span>
        )}
        <span className="flex-1" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!rootPath || !loaded}
          onClick={() => openDialog(null)}
        >
          <Plus size={13} weight="bold" />
          New task
        </Button>
        <button
          type="button"
          aria-label="Close tasks"
          title="Close"
          onClick={closeBoard}
          className="flex size-6 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
        >
          <X size={14} />
        </button>
      </div>

      {!rootPath || loadFailed ? (
        <p className="m-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-ui-xs text-fg-subtle">
          {rootPath ? "Could not load the tasks." : "Open a folder to keep tasks."}
        </p>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-4 gap-2 p-3">
          {TASK_COLUMNS.map((column) => {
            const items = tasks.filter((task) => task.status === column.status);
            return (
              <section
                key={column.status}
                aria-label={column.label}
                onDragOver={(event) => {
                  if (!event.dataTransfer.types.includes(TASK_MIME)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTarget(column.status);
                }}
                onDragLeave={(event) => {
                  const next = event.relatedTarget;
                  if (next instanceof Node && event.currentTarget.contains(next)) return;
                  setDropTarget(null);
                }}
                onDrop={(event) => handleDrop(column.status, event)}
                className={cn(
                  "flex min-h-0 flex-col rounded-lg bg-bg-hover/40 transition-colors",
                  dropTarget === column.status && "bg-accent-subtle ring-1 ring-primary/40",
                )}
              >
                <h3 className="flex shrink-0 items-center gap-1.5 px-2.5 pt-2 pb-1.5 text-ui-xs font-medium text-fg-muted">
                  {column.label}
                  <span className="text-fg-subtle tabular-nums">{items.length}</span>
                </h3>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1.5 pb-1.5">
                  {items.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agentName={
                        task.agentId
                          ? (agents.find((agent) => agent.id === task.agentId)?.name ?? null)
                          : null
                      }
                      actions={resolveTaskActions(
                        task,
                        liveSessionId,
                        task.sessionId !== undefined && sessionIds.has(task.sessionId),
                      )}
                      onEdit={() => openDialog(task)}
                      onRun={() => {
                        if (rootPath) void runTask(rootPath, task);
                      }}
                      onStop={() => stopTask(task)}
                      onResume={() => {
                        if (rootPath) void resumeTask(rootPath, task);
                      }}
                      onDelete={() => setToDelete(task)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TaskDialog open={dialogOpen} task={editing} onOpenChange={setDialogOpen} />
      <DeleteTaskDialog
        task={toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
