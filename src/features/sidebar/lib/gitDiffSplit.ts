import { useEditorStore, type DiffTab } from "@/shared/stores/editor";
import { useLayoutStore } from "@/shell/layout/store";
import { allPanelIds, findParent } from "@/shell/layout/tree/operations";
import type { LayoutNode } from "@/shell/layout/tree/types";

const DIFF_SPLIT_PERCENT = 35;

type GitDiffInput = Omit<DiffTab, "kind" | "name" | "id"> & { id: string; name?: string };

export function diffSplitSizes(childIds: string[], diffPanelId: string): number[] {
  const otherCount = childIds.length - 1;
  if (otherCount <= 0) return childIds.map(() => 100);
  const otherSize = (100 - DIFF_SPLIT_PERCENT) / otherCount;
  return childIds.map((childId) => (childId === diffPanelId ? DIFF_SPLIT_PERCENT : otherSize));
}

/// Shows a git diff in a new editor panel below the focused one, keeping the file visible.
export function openGitDiffInSplit(editorPanelId: string | null, diff: GitDiffInput): void {
  const editor = useEditorStore.getState();
  const previousTabId = editorPanelId ? editor.getPanelActiveTabId(editorPanelId) : null;

  editor.openDiff(diff);

  if (!editorPanelId) return;

  // openDiff activates the diff globally; pin the source panel back to its file.
  if (previousTabId) {
    useEditorStore.getState().setPanelActiveTab(editorPanelId, previousTabId);
  }

  const layout = useLayoutStore.getState();
  const panelIdsBefore = new Set(allPanelIds(layout.root));
  layout.splitPanel(editorPanelId, "vertical", "editor");

  const root = useLayoutStore.getState().root;
  const diffPanelId = allPanelIds(root).find((panelId) => !panelIdsBefore.has(panelId));
  if (!diffPanelId) return;

  useEditorStore.getState().setPanelActiveTab(diffPanelId, diff.id);
  applyDiffSplitSize(root, diffPanelId);
}

function applyDiffSplitSize(root: LayoutNode, diffPanelId: string): void {
  const ref = findParent(root, diffPanelId);
  if (!ref || ref.parent.type !== "split") return;

  const sizes = diffSplitSizes(
    ref.parent.children.map((child) => child.id),
    diffPanelId,
  );
  useLayoutStore.getState().updateSplitSizes(ref.parent.id, sizes);
}
