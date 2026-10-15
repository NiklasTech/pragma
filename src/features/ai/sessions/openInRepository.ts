import { selectRootFolder } from "@/shared/hooks/useFileExplorer";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { useAgentsPanesStore } from "../panes/store";

/// Makes the repository active unless it already is; Agents mode then shows its pane layout.
export async function activateRepository(rootPath: string): Promise<void> {
  if ((useFileExplorerStore.getState().rootPath ?? "default") === rootPath) return;
  await selectRootFolder(rootPath);
}

/// Shows the session in the pane layout of its repository and makes that repository active.
export async function openInRepository(rootPath: string, sessionId: string): Promise<void> {
  useAgentsPanesStore.getState().openSession(rootPath, sessionId);
  await activateRepository(rootPath);
}
