import { selectRootFolder } from "@/shared/hooks/useFileExplorer";
import { useAIStore } from "@/shared/stores/ai";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { showSessionInPane } from "../children/open";
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

/// The repository a session belongs to, the active one for a session that is not loaded.
export function sessionRepository(sessionId: string): string {
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  return session?.rootPath ?? useFileExplorerStore.getState().rootPath ?? "default";
}

/// Makes the session's repository active first, then shows the session in that repository's layout.
export async function showSessionInRepository(
  sessionId: string,
  show: (rootPath: string, sessionId: string) => void = showSessionInPane,
): Promise<void> {
  const rootPath = sessionRepository(sessionId);
  await activateRepository(rootPath);
  show(rootPath, sessionId);
}
