import { useUiModeStore } from "@/shell/mode";

import { showSessionInRepository } from "../sessions/openInRepository";
import { useTasksUiStore } from "../tasks/ui";

export function focusAttentionSession(sessionId: string): void {
  useUiModeStore.getState().setUiMode("agents");
  useTasksUiStore.getState().closeBoard();
  void showSessionInRepository(sessionId);
}
