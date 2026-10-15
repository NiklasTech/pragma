import { useUiModeStore } from "@/shell/mode";

import { useNamedAgentsUiStore } from "../named-agents/ui";
import { useTasksUiStore } from "../tasks/ui";

/// Opens the task board of a repository in Agents mode without changing the active repository.
export function showRepositoryTasks(rootPath: string): void {
  useNamedAgentsUiStore.getState().setView("sessions");
  useUiModeStore.getState().setUiMode("agents");
  useTasksUiStore.getState().openBoard(rootPath);
}
