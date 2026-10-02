export interface Leaf {
  id: string;
  sessionId: string | null;
  browser?: true;
}

export interface TabsNode {
  type: "tabs";
  id: string;
  activeLeafId: string;
  children: Leaf[];
}

export interface SplitNode {
  type: "split";
  id: string;
  direction: "horizontal" | "vertical";
  children: PaneNode[];
  sizes: number[];
}

export type PaneNode = SplitNode | TabsNode;

export type PaneRoot = PaneNode | null;

export const MAX_PANES = 8;
export const MAX_PANES_TITLE = "8 panes is the maximum";

let idCounter = 0;

export function generatePaneId(prefix = "pane"): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

export function distributeSizes(count: number): number[] {
  if (count <= 0) return [];
  const base = 100 / count;
  const sizes = Array.from({ length: count }, () => base);
  const sum = sizes.reduce((total, size) => total + size, 0);
  if (sum !== 100) {
    sizes[sizes.length - 1] = 100 - (sum - sizes[sizes.length - 1]);
  }
  return sizes;
}

export function createLeaf(sessionId: string | null, id = generatePaneId("leaf")): Leaf {
  return { id, sessionId };
}

export function createBrowserLeaf(id = generatePaneId("leaf")): Leaf {
  return { id, sessionId: null, browser: true };
}

export function createTabs(
  children: Leaf[],
  activeLeafId = children[0]?.id ?? "",
  id = generatePaneId("tabs"),
): TabsNode {
  return { type: "tabs", id, activeLeafId, children };
}

export function createSplit(
  direction: SplitNode["direction"],
  children: PaneNode[],
  sizes?: number[],
  id = generatePaneId("split"),
): SplitNode {
  const safeSizes =
    sizes && sizes.length === children.length ? sizes : distributeSizes(children.length);
  return { type: "split", id, direction, children, sizes: safeSizes };
}

export function countLeaves(root: PaneRoot): number {
  if (!root) return 0;
  if (root.type === "tabs") return root.children.length;
  return root.children.reduce((total, child) => total + countLeaves(child), 0);
}

export function findLeaf(root: PaneRoot, leafId: string): Leaf | null {
  if (!root) return null;
  if (root.type === "tabs") return root.children.find((leaf) => leaf.id === leafId) ?? null;
  for (const child of root.children) {
    const found = findLeaf(child, leafId);
    if (found) return found;
  }
  return null;
}

export function findLeafBySession(root: PaneRoot, sessionId: string): Leaf | null {
  if (!root) return null;
  if (root.type === "tabs") {
    return root.children.find((leaf) => leaf.sessionId === sessionId) ?? null;
  }
  for (const child of root.children) {
    const found = findLeafBySession(child, sessionId);
    if (found) return found;
  }
  return null;
}

export function findBrowserLeaf(root: PaneRoot): Leaf | null {
  if (!root) return null;
  if (root.type === "tabs") return root.children.find((leaf) => leaf.browser) ?? null;
  for (const child of root.children) {
    const found = findBrowserLeaf(child);
    if (found) return found;
  }
  return null;
}

export function findGroup(root: PaneRoot, groupId: string): TabsNode | null {
  if (!root) return null;
  if (root.type === "tabs") return root.id === groupId ? root : null;
  for (const child of root.children) {
    const found = findGroup(child, groupId);
    if (found) return found;
  }
  return null;
}

export function findNode(root: PaneRoot, id: string): PaneNode | null {
  if (!root) return null;
  if (root.id === id) return root;
  if (root.type === "tabs") return null;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findLeafGroup(root: PaneRoot, leafId: string): TabsNode | null {
  if (!root) return null;
  if (root.type === "tabs") {
    return root.children.some((leaf) => leaf.id === leafId) ? root : null;
  }
  for (const child of root.children) {
    const found = findLeafGroup(child, leafId);
    if (found) return found;
  }
  return null;
}

export function firstLeaf(root: PaneRoot): Leaf | null {
  if (!root) return null;
  if (root.type === "tabs") return root.children[0] ?? null;
  for (const child of root.children) {
    const found = firstLeaf(child);
    if (found) return found;
  }
  return null;
}

function updateGroup(
  root: PaneNode,
  groupId: string,
  update: (group: TabsNode) => TabsNode,
): PaneNode {
  if (root.type === "tabs") return root.id === groupId ? update(root) : root;
  return {
    ...root,
    children: root.children.map((child) => updateGroup(child, groupId, update)),
  };
}

export function assignLeafSession(root: PaneRoot, leafId: string, sessionId: string): PaneRoot {
  if (!root) return root;
  const group = findLeafGroup(root, leafId);
  if (!group) return root;

  return updateGroup(root, group.id, (current) => ({
    ...current,
    activeLeafId: leafId,
    children: current.children.map((leaf) =>
      leaf.id === leafId ? { id: leaf.id, sessionId } : leaf,
    ),
  }));
}

export function updateSplitSizes(root: PaneRoot, splitId: string, sizes: number[]): PaneRoot {
  if (!root) return root;
  if (root.type === "tabs") return root;
  if (root.id === splitId) {
    if (sizes.length !== root.children.length) return root;
    if (sizes.every((size, index) => Math.abs(size - root.sizes[index]) < 0.01)) return root;
    return { ...root, sizes };
  }
  const children: PaneNode[] = [];
  let changed = false;
  for (const child of root.children) {
    const next = updateSplitSizes(child, splitId, sizes) ?? child;
    if (next !== child) changed = true;
    children.push(next);
  }
  if (!changed) return root;
  return { ...root, children };
}
