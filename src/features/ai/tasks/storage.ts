import { invoke } from "@tauri-apps/api/core";

import type { Task } from "./types";

export async function loadTasks(rootPath: string): Promise<Task[]> {
  return invoke<Task[]>("tasks_load", { req: { root_path: rootPath } });
}

export async function saveTasks(rootPath: string, tasks: Task[]): Promise<void> {
  await invoke("tasks_save", { req: { root_path: rootPath, tasks } });
}
