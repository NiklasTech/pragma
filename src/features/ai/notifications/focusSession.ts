import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useUiModeStore } from "@/shell/mode";

import { showSessionInPane } from "../children/open";
import { useTasksUiStore } from "../tasks/ui";

export function focusAttentionSession(sessionId: string): void {
  const rootPath = useFileExplorerStore.getState().rootPath ?? "default";
  useUiModeStore.getState().setUiMode("agents");
  useTasksUiStore.getState().closeBoard();
  showSessionInPane(rootPath, sessionId);
}
