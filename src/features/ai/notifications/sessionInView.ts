import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { resolveUiMode, useUiModeStore } from "@/shell/mode";

import { selectFocusedSessionId, useAgentsPanesStore } from "../panes/store";
import { useTasksUiStore } from "../tasks/ui";
import { isSessionInView } from "./delivery";

export function readSessionInView(sessionId: string): boolean {
  const rootPath = useFileExplorerStore.getState().rootPath;
  return isSessionInView(sessionId, {
    uiMode: resolveUiMode(useUiModeStore.getState().uiMode, rootPath !== null),
    boardOpen: useTasksUiStore.getState().boardOpen,
    focusedSessionId: selectFocusedSessionId(useAgentsPanesStore.getState(), rootPath ?? "default"),
  });
}
