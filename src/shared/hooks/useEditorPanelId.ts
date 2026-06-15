import { useLayoutStore } from "@/shell/layout";
import { findNode, findPanelByKind } from "@/shell/layout/tree/operations";
import { useEditorStore } from "@/shared/stores/editor";
import type { LayoutNode } from "@/shell/layout/tree/types";

function isEditorPanel(panelId: string | null, root: LayoutNode): boolean {
  if (!panelId) return false;
  const node = findNode(root, panelId);
  return node?.type === "panel" && node.kind === "editor";
}

export function useEditorPanelId(): string | null {
  const lastFocusedPanelId = useEditorStore((s) => s.lastFocusedPanelId);
  const root = useLayoutStore((s) => s.root);

  if (isEditorPanel(lastFocusedPanelId, root)) {
    return lastFocusedPanelId;
  }

  return findPanelByKind(root, "editor")?.id ?? null;
}
