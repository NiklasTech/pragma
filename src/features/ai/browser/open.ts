import {
  countLeaves,
  createBrowserLeaf,
  findBrowserLeaf,
  MAX_PANES,
  type PaneRoot,
} from "../panes/operations";
import { useAgentsPanesStore } from "../panes/store";
import { useBrowserHistoryStore } from "./history";

export type BrowserOpenResult = "navigated" | "opened" | "full";

function currentRoot(rootPath: string): PaneRoot {
  return useAgentsPanesStore.getState().trees[rootPath]?.root ?? null;
}

export function canOpenBrowserPane(root: PaneRoot): boolean {
  return countLeaves(root) < MAX_PANES;
}

/// Adds an empty browser pane right of the focused pane and focuses it.
export function openBrowserPane(rootPath: string): boolean {
  if (!canOpenBrowserPane(currentRoot(rootPath))) return false;
  useAgentsPanesStore.getState().addPaneRight(rootPath, createBrowserLeaf(), true);
  return true;
}

/// Navigates the open browser pane, else opens one right of the focused pane within the cap.
export function openUrlInBrowser(rootPath: string, url: string, focus: boolean): BrowserOpenResult {
  const panes = useAgentsPanesStore.getState();
  const root = currentRoot(rootPath);
  const existing = findBrowserLeaf(root);
  if (existing) {
    useBrowserHistoryStore.getState().navigate(existing.id, url);
    if (focus) panes.focusLeaf(rootPath, existing.id);
    return "navigated";
  }

  if (!canOpenBrowserPane(root)) return "full";
  const leaf = createBrowserLeaf();
  useBrowserHistoryStore.getState().navigate(leaf.id, url);
  panes.addPaneRight(rootPath, leaf, focus);
  return "opened";
}
