import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useLayoutStore } from "@/shell/layout";
import { resolveUiMode, useUiModeStore } from "@/shell/mode";

/// The terminal lives in the editor layout, so a terminal shortcut in the Agents workspace switches to the editor.
export function leaveAgentsForTerminal(): boolean {
  const { uiMode, setUiMode } = useUiModeStore.getState();
  const hasRootPath = useFileExplorerStore.getState().rootPath !== null;
  if (resolveUiMode(uiMode, hasRootPath) !== "agents") return false;
  setUiMode("editor");
  return true;
}

export function toggleTerminalFromShortcut(): void {
  const layout = useLayoutStore.getState();
  // Hiding would close the shells of a terminal the Agents workspace does not show.
  if (leaveAgentsForTerminal() && layout.terminal.mode !== "hidden") return;
  layout.toggleTerminal();
}
