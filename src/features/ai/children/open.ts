import { countLeaves, MAX_PANES } from "../panes/operations";
import { paneTreeKey, selectEntry, useAgentsPanesStore } from "../panes/store";

/// Focuses the session's pane, else adds a pane below the cap, else uses the focused pane.
export function showSessionInPane(rootPath: string, sessionId: string): void {
  const panes = useAgentsPanesStore.getState();
  const entry = selectEntry(panes, paneTreeKey(rootPath));
  const focusedLeafId = entry?.focusedLeafId ?? null;
  if (countLeaves(entry?.root ?? null) >= MAX_PANES && focusedLeafId) {
    panes.assignSession(rootPath, focusedLeafId, sessionId);
    return;
  }
  panes.openSession(rootPath, sessionId);
}
