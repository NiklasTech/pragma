import { useEffect } from "react";

import { findPanelByKind } from "@/shell/layout/tree/operations";
import { useLayoutStore } from "@/shell/layout/store";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import type { LspDocumentSymbolItem } from "./client";

export interface OutlineNode {
  item: LspDocumentSymbolItem;
  children: OutlineNode[];
}

export function buildOutlineTree(items: LspDocumentSymbolItem[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  for (const item of items) {
    const node: OutlineNode = { item, children: [] };
    const depth = Math.min(Math.max(item.depth, 0), stack.length);
    if (depth === 0) {
      roots.push(node);
    } else {
      stack[depth - 1].children.push(node);
    }
    stack.length = depth;
    stack.push(node);
  }

  return roots;
}

export function outlineNodeKey(node: OutlineNode, parentKey: string, index: number): string {
  return `${parentKey}/${index}:${node.item.kind}:${node.item.name}`;
}

export function openOutlinePanel(): void {
  const layout = useLayoutStore.getState();
  const alreadyOpen =
    findPanelByKind(layout.root, "outline") !== null ||
    layout.floating.some((entry) => findPanelByKind(entry.child, "outline") !== null);
  if (alreadyOpen) {
    return;
  }

  const editorPanel = findPanelByKind(layout.root, "editor");
  if (editorPanel) {
    layout.splitPanel(editorPanel.id, "horizontal", "outline");
    return;
  }

  layout.addFloatingPanel("outline");
}

export function useOutlineCommand(): void {
  const registerCommand = useCommandPaletteStore((state) => state.registerCommand);
  const unregisterCommand = useCommandPaletteStore((state) => state.unregisterCommand);

  useEffect(() => {
    registerCommand({
      id: "view.toggleOutline",
      label: "View: Toggle Outline",
      category: "view",
      action: openOutlinePanel,
    });

    return () => {
      unregisterCommand("view.toggleOutline");
    };
  }, [registerCommand, unregisterCommand]);
}
