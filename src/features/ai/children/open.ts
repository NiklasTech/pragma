import { countLeaves, findLeafBySession, MAX_PANES, type PaneRoot } from "../panes/operations";
import { useAgentsPanesStore } from "../panes/store";

function leafIds(root: PaneRoot): string[] {
  if (!root) return [];
  if (root.type === "tabs") return root.children.map((leaf) => leaf.id);
  return root.children.flatMap((child) => leafIds(child));
}

/// Focuses the session's pane, else splits right below the pane cap, else uses the focused pane.
export function showSessionInPane(rootPath: string, sessionId: string): void {
  const panes = useAgentsPanesStore.getState();
  const entry = panes.trees[rootPath];
  const root = entry?.root ?? null;

  const existing = findLeafBySession(root, sessionId);
  if (existing) {
    panes.focusLeaf(rootPath, existing.id);
    return;
  }

  const focusedLeafId = entry?.focusedLeafId ?? null;
  if (!root || !focusedLeafId) {
    panes.openSession(rootPath, sessionId);
    return;
  }

  if (countLeaves(root) < MAX_PANES) {
    const before = new Set(leafIds(root));
    panes.splitRight(rootPath);
    const after = useAgentsPanesStore.getState().trees[rootPath]?.root ?? null;
    const created = leafIds(after).find((id) => !before.has(id));
    if (created) {
      panes.assignSession(rootPath, created, sessionId);
      return;
    }
  }

  panes.assignSession(rootPath, focusedLeafId, sessionId);
}
