import { matchShortcut, TAB_SELECT_SHORTCUTS, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";

import { usePaneMaximizeStore } from "./maximize";
import { pickNeighbor, type PaneDirection, type PlacedPane } from "./paneNeighbor";
import type { SplitDirection } from "./split";
import { findLeafGroup } from "./operations";
import { paneTreeKey, useAgentsPanesStore } from "./store";
import { animatePanes, animateRestore } from "./transition";

// The terminal's input, the composer, or any other text field inside the pane.
const PANE_INPUT = ".xterm-helper-textarea, textarea, input, [contenteditable='true']";

const PANE_SHORTCUTS: ShortcutActionId[] = [
  "pane.focusLeft",
  "pane.focusRight",
  "pane.focusUp",
  "pane.focusDown",
  "pane.toggleZoom",
  "pane.splitRight",
  "pane.splitDown",
  ...TAB_SELECT_SHORTCUTS,
];

/** True for keys that move between or zoom panes, which a terminal must not type. */
export function isPaneShortcut(event: KeyboardEvent): boolean {
  const { shortcuts } = useSettingsStore.getState();
  return PANE_SHORTCUTS.some((id) => matchShortcut(event, shortcuts[id]));
}

function currentRoot(): string {
  return useFileExplorerStore.getState().rootPath ?? "default";
}

function paneCard(leafId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-pane-leaf="${CSS.escape(leafId)}"]`);
}

/** Puts the keyboard into a pane once React has rendered its focused content. */
function focusPaneInput(leafId: string): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      paneCard(leafId)?.querySelector<HTMLElement>(PANE_INPUT)?.focus({ preventScroll: true });
    });
  });
}

/** Zooms a pane over its tab, or shrinks the zoomed pane back onto its slot. */
export function togglePaneZoom(rootPath: string, leafId: string): void {
  const entry = useAgentsPanesStore.getState().trees[paneTreeKey(rootPath)];
  const group = findLeafGroup(entry?.root ?? null, leafId);
  if (!group) return;
  const { maximized, toggle } = usePaneMaximizeStore.getState();
  if (maximized[rootPath] === group.id) {
    const card = document.querySelector<HTMLElement>(`[data-pane-group="${CSS.escape(group.id)}"]`);
    animateRestore(card, () => toggle(rootPath, group.id));
    return;
  }
  animatePanes(() => {
    useAgentsPanesStore.getState().focusLeaf(rootPath, leafId);
    toggle(rootPath, group.id);
  });
}

/** Zooms the focused pane of the active tab; false when the tab shows no panes. */
export function toggleFocusedPaneZoom(): boolean {
  const rootPath = currentRoot();
  const leafId = useAgentsPanesStore.getState().trees[paneTreeKey(rootPath)]?.focusedLeafId;
  if (!leafId || !paneCard(leafId)) return false;
  togglePaneZoom(rootPath, leafId);
  focusPaneInput(leafId);
  return true;
}

/** Moves focus to the pane beside the focused one; false when the tab shows no panes. */
export function focusPaneInDirection(direction: PaneDirection): boolean {
  const rootPath = currentRoot();
  const leafId = useAgentsPanesStore.getState().trees[paneTreeKey(rootPath)]?.focusedLeafId;
  const current = leafId ? paneCard(leafId) : null;
  if (!leafId || !current) return false;

  const panes: PlacedPane[] = Array.from(document.querySelectorAll<HTMLElement>("[data-pane-leaf]"))
    .filter((card) => card !== current && card.dataset.paneLeaf)
    .map((card) => ({ id: card.dataset.paneLeaf ?? "", rect: card.getBoundingClientRect() }));
  // A zoomed pane is measured at its grid slot, which its panel keeps free.
  const zoomed = current.dataset.paneMaximized === "true";
  const from = (zoomed ? current.parentElement : current)?.getBoundingClientRect();
  const target = from ? pickNeighbor(from, panes, direction) : null;
  // At the edge the key is still taken, so the terminal does not receive it as input.
  if (!target) return true;

  const move = () => useAgentsPanesStore.getState().focusLeaf(rootPath, target);
  if (zoomed) {
    animateRestore(current, () => {
      usePaneMaximizeStore.getState().restore(rootPath);
      move();
    });
  } else {
    move();
  }
  focusPaneInput(target);
  return true;
}

/** Opens an empty pane beside the focused one; false when the tab shows no panes. */
export function splitFocusedPane(direction: SplitDirection): boolean {
  const rootPath = currentRoot();
  const leafId = useAgentsPanesStore.getState().trees[paneTreeKey(rootPath)]?.focusedLeafId;
  if (!leafId || !paneCard(leafId)) return false;
  useAgentsPanesStore.getState().splitPane(rootPath, leafId, direction);
  return true;
}
