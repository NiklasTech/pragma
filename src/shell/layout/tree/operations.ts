import type {
  DropTarget,
  DropZone,
  FloatingNode,
  LayoutNode,
  PanelKind,
  PanelNode,
  SplitNode,
  TabsNode,
} from "./types";

let idCounter = 0;

export function generateId(prefix = "node"): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

export function createPanel(kind: PanelKind, id = generateId("panel")): PanelNode {
  return { type: "panel", id, kind };
}

export function createTabs(
  children: PanelNode[],
  activeTabId: string | null = children[0]?.id ?? null,
  id = generateId("tabs"),
): TabsNode {
  return { type: "tabs", id, activeTabId, children };
}

export function createSplit(
  direction: SplitNode["direction"],
  children: LayoutNode[],
  sizes?: number[],
  id = generateId("split"),
): SplitNode {
  const safeSizes =
    sizes && sizes.length === children.length ? sizes : distributeSizes(children.length);
  return { type: "split", id, direction, children, sizes: safeSizes };
}

export function createFloating(
  child: LayoutNode,
  rect: { x: number; y: number; width: number; height: number },
  id = generateId("floating"),
): FloatingNode {
  return { type: "floating", id, ...rect, child };
}

export function distributeSizes(count: number): number[] {
  if (count <= 0) return [];
  const base = 100 / count;
  const sizes = Array.from({ length: count }, () => base);
  // Fix floating point rounding so sum is exactly 100.
  const sum = sizes.reduce((a, b) => a + b, 0);
  if (sum !== 100 && sizes.length > 0) {
    sizes[sizes.length - 1] = 100 - (sum - sizes[sizes.length - 1]);
  }
  return sizes;
}

export function findNode(root: LayoutNode, id: string): LayoutNode | null {
  if (root.id === id) return root;
  if (root.type === "split") {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  if (root.type === "tabs") {
    for (const child of root.children) {
      if (child.id === id) return child;
    }
  }
  if (root.type === "floating") {
    return findNode(root.child, id);
  }
  return null;
}

export function findPanelByKind(root: LayoutNode, kind: PanelKind): PanelNode | null {
  if (root.type === "panel" && root.kind === kind) return root;
  if (root.type === "split") {
    for (const child of root.children) {
      const found = findPanelByKind(child, kind);
      if (found) return found;
    }
  }
  if (root.type === "tabs") {
    for (const child of root.children) {
      if (child.kind === kind) return child;
    }
  }
  if (root.type === "floating") {
    return findPanelByKind(root.child, kind);
  }
  return null;
}

export interface ParentRef {
  parent: SplitNode | TabsNode;
  index: number;
}

export function findParent(root: LayoutNode, id: string): ParentRef | null {
  if (root.type === "split") {
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];
      if (child.id === id) return { parent: root, index: i };
      const found = findParent(child, id);
      if (found) return found;
    }
  }
  if (root.type === "tabs") {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].id === id) return { parent: root, index: i };
    }
  }
  if (root.type === "floating") {
    if (root.child.id === id) return null; // floating is its own container
    return findParent(root.child, id);
  }
  return null;
}

function mapNode(root: LayoutNode, id: string, fn: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (root.id === id) return fn(root);
  if (root.type === "split") {
    return {
      ...root,
      children: root.children.map((child) => mapNode(child, id, fn)),
    };
  }
  if (root.type === "tabs") {
    return {
      ...root,
      children: root.children.map((child) => (child.id === id ? (fn(child) as PanelNode) : child)),
    };
  }
  if (root.type === "floating") {
    return { ...root, child: mapNode(root.child, id, fn) };
  }
  return root;
}

function removeFromParent(parent: SplitNode | TabsNode, index: number): LayoutNode | null {
  if (parent.type === "tabs") {
    const children = parent.children.filter((_, i) => i !== index);
    if (children.length === 0) return null;
    const activeTabId =
      parent.activeTabId && children.some((c) => c.id === parent.activeTabId)
        ? parent.activeTabId
        : (children[0]?.id ?? null);
    return { ...parent, children, activeTabId };
  }

  // Split
  const children = parent.children.filter((_, i) => i !== index);
  const sizes = distributeSizes(children.length);
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...parent, children, sizes };
}

export function removeNode(root: LayoutNode, id: string): LayoutNode | null {
  if (root.id === id) return null;

  const ref = findParent(root, id);
  if (!ref) {
    // Could be inside a floating node; handle separately.
    if (root.type === "floating") {
      const cleaned = removeNode(root.child, id);
      if (!cleaned) return null;
      return { ...root, child: cleaned };
    }
    return root;
  }

  const newParent = removeFromParent(ref.parent, ref.index);
  if (!newParent) {
    // Parent became empty. Remove parent as well.
    return removeNode(root, ref.parent.id);
  }

  return mapNode(root, ref.parent.id, () => newParent);
}

export function replaceNode(root: LayoutNode, id: string, replacement: LayoutNode): LayoutNode {
  if (root.id === id) return replacement;
  return mapNode(root, id, () => replacement);
}

function resolveContainerForSplit(root: LayoutNode, targetId: string): string {
  const ref = findParent(root, targetId);
  if (ref && ref.parent.type === "tabs") {
    return ref.parent.id;
  }
  return targetId;
}

function isHorizontalZone(zone: DropZone): boolean {
  return zone === "left" || zone === "right";
}

function zoneToDirection(zone: DropZone): SplitNode["direction"] {
  return isHorizontalZone(zone) ? "horizontal" : "vertical";
}

function insertIntoSplitAt(split: SplitNode, index: number, node: LayoutNode): SplitNode {
  const children = [...split.children];
  children.splice(index, 0, node);
  return { ...split, children, sizes: distributeSizes(children.length) };
}

export function insertAdjacent(
  root: LayoutNode,
  targetId: string,
  zone: DropZone,
  node: LayoutNode,
): LayoutNode {
  const direction = zoneToDirection(zone);
  const after = zone === "right" || zone === "bottom";

  const effectiveTargetId = resolveContainerForSplit(root, targetId);
  if (effectiveTargetId !== targetId) {
    return insertAdjacent(root, effectiveTargetId, zone, node);
  }

  const target = findNode(root, targetId);
  if (!target) return root;

  const ref = findParent(root, targetId);

  // If target is inside a split of the same direction, insert next to it.
  if (ref && ref.parent.type === "split" && ref.parent.direction === direction) {
    const index = after ? ref.index + 1 : ref.index;
    const newParent = insertIntoSplitAt(ref.parent, index, node);
    return replaceNode(root, ref.parent.id, newParent);
  }

  // Otherwise wrap target and new node in a new split.
  const newSplit = createSplit(direction, after ? [target, node] : [node, target]);
  return replaceNode(root, targetId, newSplit);
}

export function insertAsTab(root: LayoutNode, targetId: string, panel: PanelNode): LayoutNode {
  const target = findNode(root, targetId);
  if (!target) return root;

  const ref = findParent(root, targetId);
  if (target.type === "tabs") {
    const children = [...target.children, panel];
    return replaceNode(root, targetId, {
      ...target,
      children,
      activeTabId: panel.id,
    });
  }

  if (ref && ref.parent.type === "tabs") {
    const tabs = ref.parent;
    const children = [...tabs.children];
    children.splice(ref.index + 1, 0, panel);
    return replaceNode(root, tabs.id, {
      ...tabs,
      children,
      activeTabId: panel.id,
    });
  }

  // Wrap target and panel in a new tabs node.
  const tabs = createTabs([target as PanelNode, panel], panel.id);
  return replaceNode(root, targetId, tabs);
}

export function swapNodes(root: LayoutNode, aId: string, bId: string): LayoutNode {
  const a = findNode(root, aId);
  const b = findNode(root, bId);
  if (!a || !b || a.type !== "panel" || b.type !== "panel") return root;

  const next = replaceNode(root, aId, b);
  return replaceNode(next, bId, a);
}

export function moveNode(root: LayoutNode, panelId: string, target: DropTarget): LayoutNode {
  const panel = findNode(root, panelId);
  if (!panel || panel.type !== "panel") return root;

  if (target.zone === "center") {
    const cleaned = removeNode(root, panelId);
    if (!cleaned) return root;
    const swapTargetId = resolveContainerForSplit(cleaned, target.nodeId);
    return swapNodes(cleaned, panelId, swapTargetId);
  }

  if (target.zone === "tabs") {
    const cleaned = removeNode(root, panelId);
    if (!cleaned) return root;
    return insertAsTab(cleaned, target.nodeId, panel);
  }

  if (target.zone === "floating") {
    // Handled by the caller because it changes the floating array.
    return root;
  }

  const cleaned = removeNode(root, panelId);
  if (!cleaned) {
    // Panel was the only content; replace root with the moved panel.
    return panel;
  }
  const insertTargetId = resolveContainerForSplit(cleaned, target.nodeId);
  return insertAdjacent(cleaned, insertTargetId, target.zone, panel);
}

export function cleanupTree(root: LayoutNode): LayoutNode {
  if (root.type === "split") {
    const children = root.children.map(cleanupTree).filter(Boolean) as LayoutNode[];
    if (children.length === 0) {
      // Should not happen for root, but keep a welcome panel as fallback.
      return createPanel("welcome");
    }
    if (children.length === 1) return children[0];

    // Flatten nested splits with same direction.
    const flattened: LayoutNode[] = [];
    for (const child of children) {
      if (child.type === "split" && child.direction === root.direction) {
        flattened.push(...child.children);
      } else {
        flattened.push(child);
      }
    }
    return { ...root, children: flattened, sizes: distributeSizes(flattened.length) };
  }

  if (root.type === "tabs") {
    const children = root.children.filter(Boolean);
    if (children.length === 0) return createPanel("welcome");
    const activeTabId =
      root.activeTabId && children.some((c) => c.id === root.activeTabId)
        ? root.activeTabId
        : (children[0]?.id ?? null);
    return { ...root, children, activeTabId };
  }

  if (root.type === "floating") {
    return { ...root, child: cleanupTree(root.child) };
  }

  return root;
}

export function ensureDockedPanel(root: LayoutNode, kind: PanelKind): LayoutNode {
  if (findPanelByKind(root, kind)) return root;
  const panel = createPanel(kind);
  if (root.type === "split" && root.direction === "vertical") {
    const children = [...root.children, panel];
    return { ...root, children, sizes: distributeSizes(children.length) };
  }
  return createSplit("vertical", [root, panel]);
}

export function removePanelByKind(root: LayoutNode, kind: PanelKind): LayoutNode {
  const panel = findPanelByKind(root, kind);
  if (!panel) return root;
  const cleaned = removeNode(root, panel.id);
  return cleaned ?? createPanel("welcome");
}

export function updateSplitSizes(split: SplitNode, sizes: number[]): SplitNode {
  if (sizes.length !== split.children.length) return split;
  return { ...split, sizes };
}

export function setActiveTabInTabs(root: LayoutNode, tabsId: string, panelId: string): LayoutNode {
  const tabs = findNode(root, tabsId);
  if (!tabs || tabs.type !== "tabs") return root;
  if (!tabs.children.some((c) => c.id === panelId)) return root;
  return replaceNode(root, tabsId, { ...tabs, activeTabId: panelId });
}

export function allPanelIds(root: LayoutNode): string[] {
  if (root.type === "panel") return [root.id];
  if (root.type === "split") {
    return root.children.flatMap(allPanelIds);
  }
  if (root.type === "tabs") {
    return root.children.map((c) => c.id);
  }
  if (root.type === "floating") {
    return allPanelIds(root.child);
  }
  return [];
}

export function allFloatingPanelIds(floating: FloatingNode[]): string[] {
  return floating.flatMap((f) => allPanelIds(f.child));
}
