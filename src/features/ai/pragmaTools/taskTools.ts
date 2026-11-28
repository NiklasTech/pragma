import { readStringInput } from "@/features/agent/toolInput";

import { repositoryTasks, useTasksStore } from "../tasks/store";
import type { Task, TaskPriority, TaskStatus } from "../tasks/types";
import { TASK_COLUMNS, validateTaskFields } from "../tasks/validation";
import type { PragmaToolContext, PragmaToolHandler } from "./types";

const PRIORITIES: readonly TaskPriority[] = ["low", "medium", "high"];
const STATUSES: readonly TaskStatus[] = TASK_COLUMNS.map((column) => column.status);
const MAX_LABELS = 10;

/// The project's board, loaded first if no view loaded it yet.
async function boardTasks(rootPath: string): Promise<Task[]> {
  const store = useTasksStore.getState();
  if (!repositoryTasks(store.byRoot, rootPath).loaded) await store.load(rootPath);
  const board = repositoryTasks(useTasksStore.getState().byRoot, rootPath);
  if (!board.loaded) throw new Error("Pragma could not load the task board.");
  return board.tasks;
}

function readLabels(args: unknown): string[] | undefined {
  const value =
    typeof args === "object" && args !== null
      ? (args as Record<string, unknown>).labels
      : undefined;
  if (!Array.isArray(value)) return undefined;
  const labels = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_LABELS);
  return labels.length > 0 ? labels : undefined;
}

function oneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  name: string,
): T | undefined {
  if (!value) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${name} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

function describe(task: Task): string {
  const details = [task.status, task.priority, ...(task.labels ?? [])].filter(Boolean).join(", ");
  return `${task.id}  [${details}]  ${task.title}`;
}

async function listTasks(_args: unknown, context: PragmaToolContext): Promise<string> {
  const tasks = await boardTasks(context.rootPath);
  return tasks.length > 0 ? tasks.map(describe).join("\n") : "The task board is empty.";
}

async function createTask(args: unknown, context: PragmaToolContext): Promise<string> {
  const title = readStringInput(args, "title").trim();
  const notes = readStringInput(args, "notes");
  const error = validateTaskFields({ title, notes, result: "" });
  if (error) throw new Error(error);
  await boardTasks(context.rootPath);
  const now = Date.now();
  const task: Task = {
    id: crypto.randomUUID(),
    title,
    notes,
    status: "todo",
    result: "",
    priority: oneOf(readStringInput(args, "priority"), PRIORITIES, "priority"),
    labels: readLabels(args),
    createdAt: now,
    updatedAt: now,
  };
  await useTasksStore.getState().addTasks(context.rootPath, [task]);
  return `Added task ${task.id}: ${task.title}`;
}

async function updateTask(args: unknown, context: PragmaToolContext): Promise<string> {
  const id = readStringInput(args, "task").trim();
  const task = (await boardTasks(context.rootPath)).find((item) => item.id === id);
  if (!task) throw new Error(`No task ${id}; list them with tasks_list.`);
  const field = (key: string) => {
    const value = readStringInput(args, key);
    return value === "" ? undefined : value;
  };
  const next: Task = {
    ...task,
    title: field("title")?.trim() ?? task.title,
    notes: field("notes") ?? task.notes,
    result: field("result") ?? task.result,
    status: oneOf(readStringInput(args, "status"), STATUSES, "status") ?? task.status,
    updatedAt: Date.now(),
  };
  const error = validateTaskFields(next);
  if (error) throw new Error(error);
  await useTasksStore.getState().saveTask(context.rootPath, next);
  return `Updated task ${describe(next)}`;
}

export const TASK_TOOLS: Record<string, PragmaToolHandler> = {
  tasks_list: listTasks,
  task_create: createTask,
  task_update: updateTask,
};
