export interface Leaf {
  id: string;
  sessionId: string | null;
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

export type SplitZone = "left" | "right" | "top" | "bottom";

export const MAX_PANES = 8;

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

export function findGroup(root: PaneRoot, groupId: string): TabsNode | null {
  if (!root) return null;
  if (root.type === "tabs") return root.id === groupId ? root : null;
  for (const child of root.children) {
    const found = findGroup(child, groupId);
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

function replaceNode(root: PaneNode, id: string, replacement: PaneNode): PaneNode {
  if (root.id === id) return replacement;
  if (root.type === "split") {
    return {
      ...root,
      children: root.children.map((child) => replaceNode(child, id, replacement)),
    };
  }
  return root;
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

function findParentOfNode(root: PaneNode, id: string): { split: SplitNode; index: number } | null {
  if (root.type !== "split") return null;
  for (let index = 0; index < root.children.length; index += 1) {
    if (root.children[index].id === id) return { split: root, index };
    const found = findParentOfNode(root.children[index], id);
    if (found) return found;
  }
  return null;
}

function insertGroupBeside(
  root: PaneNode,
  groupId: string,
  node: PaneNode,
  direction: SplitNode["direction"],
  after: boolean,
): PaneNode {
  const group = findGroup(root, groupId);
  if (!group) return root;

  const parent = findParentOfNode(root, groupId);
  if (parent && parent.split.direction === direction) {
    const children = [...parent.split.children];
    children.splice(after ? parent.index + 1 : parent.index, 0, node);
    return replaceNode(root, parent.split.id, {
      ...parent.split,
      children,
      sizes: distributeSizes(children.length),
    });
  }

  const newSplit = createSplit(direction, after ? [group, node] : [node, group], [50, 50]);
  return replaceNode(root, groupId, newSplit);
}

export function removeLeaf(
  root: PaneRoot,
  leafId: string,
): { root: PaneRoot; removed: Leaf | null } {
  if (!root) return { root: null, removed: null };

  if (root.type === "tabs") {
    const removed = root.children.find((leaf) => leaf.id === leafId) ?? null;
    if (!removed) return { root, removed: null };

    const children = root.children.filter((leaf) => leaf.id !== leafId);
    if (children.length === 0) return { root: null, removed };

    const activeLeafId = root.activeLeafId === leafId ? children[0].id : root.activeLeafId;
    return { root: { ...root, children, activeLeafId }, removed };
  }

  let removed: Leaf | null = null;
  const children: PaneNode[] = [];
  for (const child of root.children) {
    const result = removeLeaf(child, leafId);
    if (result.removed) removed = result.removed;
    if (result.root) children.push(result.root);
  }

  if (!removed) return { root, removed: null };
  if (children.length === 0) return { root: null, removed };
  if (children.length === 1) return { root: children[0], removed };
  return { root: { ...root, children, sizes: distributeSizes(children.length) }, removed };
}

export function focusLeaf(root: PaneRoot, leafId: string): PaneRoot {
  if (!root) return root;
  const group = findLeafGroup(root, leafId);
  if (!group) return root;
  if (group.activeLeafId === leafId) return root;
  return updateGroup(root, group.id, (current) => ({ ...current, activeLeafId: leafId }));
}

export function setActiveTab(root: PaneRoot, groupId: string, leafId: string): PaneRoot {
  if (!root) return root;
  const group = findGroup(root, groupId);
  if (!group) return root;
  if (!group.children.some((leaf) => leaf.id === leafId)) return root;
  if (group.activeLeafId === leafId) return root;
  return updateGroup(root, groupId, (current) => ({ ...current, activeLeafId: leafId }));
}

function firstGroup(root: PaneNode): TabsNode | null {
  if (root.type === "tabs") return root;
  for (const child of root.children) {
    const found = firstGroup(child);
    if (found) return found;
  }
  return null;
}

export function openSession(
  root: PaneRoot,
  focusedLeafId: string | null,
  sessionId: string,
): { root: PaneRoot; focusedLeafId: string | null } {
  const existing = findLeafBySession(root, sessionId);
  if (existing) {
    return { root: focusLeaf(root, existing.id), focusedLeafId: existing.id };
  }

  if (countLeaves(root) >= MAX_PANES) {
    return { root, focusedLeafId };
  }

  const leaf = createLeaf(sessionId);
  if (!root) {
    return { root: createTabs([leaf], leaf.id), focusedLeafId: leaf.id };
  }

  const group = (focusedLeafId ? findLeafGroup(root, focusedLeafId) : null) ?? firstGroup(root);
  if (!group) {
    return { root: createTabs([leaf], leaf.id), focusedLeafId: leaf.id };
  }

  const nextRoot = updateGroup(root, group.id, (current) => ({
    ...current,
    children: [...current.children, leaf],
    activeLeafId: leaf.id,
  }));

  return { root: nextRoot, focusedLeafId: leaf.id };
}

export function assignLeafSession(root: PaneRoot, leafId: string, sessionId: string): PaneRoot {
  if (!root) return root;
  const group = findLeafGroup(root, leafId);
  if (!group) return root;

  return updateGroup(root, group.id, (current) => ({
    ...current,
    activeLeafId: leafId,
    children: current.children.map((leaf) => (leaf.id === leafId ? { ...leaf, sessionId } : leaf)),
  }));
}

export function splitFocused(
  root: PaneRoot,
  focusedLeafId: string | null,
  direction: SplitNode["direction"],
): { root: PaneRoot; focusedLeafId: string | null } {
  if (!root || countLeaves(root) >= MAX_PANES) return { root, focusedLeafId };

  const leaf = focusedLeafId ? findLeaf(root, focusedLeafId) : null;
  if (!leaf) return { root, focusedLeafId };

  const group = findLeafGroup(root, leaf.id);
  if (!group) return { root, focusedLeafId };

  const newLeaf = createLeaf(leaf.sessionId);
  const newGroup = createTabs([newLeaf], newLeaf.id);
  return {
    root: insertGroupBeside(root, group.id, newGroup, direction, true),
    focusedLeafId: newLeaf.id,
  };
}

export function closeLeaf(
  root: PaneRoot,
  focusedLeafId: string | null,
  leafId: string,
): { root: PaneRoot; focusedLeafId: string | null } {
  const result = removeLeaf(root, leafId);
  if (!result.removed) return { root, focusedLeafId };

  const nextFocused =
    focusedLeafId === leafId ? (firstLeaf(result.root)?.id ?? null) : focusedLeafId;
  return { root: result.root, focusedLeafId: nextFocused };
}

export function dockAsTab(root: PaneRoot, sourceLeafId: string, targetLeafId: string): PaneRoot {
  if (!root || sourceLeafId === targetLeafId) return root;

  const sourceLeaf = findLeaf(root, sourceLeafId);
  if (!sourceLeaf) return root;

  const sourceGroup = findLeafGroup(root, sourceLeafId);
  const targetGroup = findLeafGroup(root, targetLeafId);
  if (!sourceGroup || !targetGroup || sourceGroup.id === targetGroup.id) return root;

  const { root: withoutSource } = removeLeaf(root, sourceLeafId);
  if (!withoutSource) return root;

  const group = findLeafGroup(withoutSource, targetLeafId);
  if (!group) return root;

  return updateGroup(withoutSource, group.id, (current) => ({
    ...current,
    children: [...current.children, sourceLeaf],
    activeLeafId: sourceLeaf.id,
  }));
}

export function splitToward(
  root: PaneRoot,
  sourceLeafId: string,
  targetLeafId: string,
  zone: SplitZone,
): PaneRoot {
  if (!root || sourceLeafId === targetLeafId || countLeaves(root) >= MAX_PANES) return root;

  const sourceLeaf = findLeaf(root, sourceLeafId);
  if (!sourceLeaf) return root;

  const sourceGroup = findLeafGroup(root, sourceLeafId);
  const targetGroup = findLeafGroup(root, targetLeafId);
  if (!sourceGroup || !targetGroup || sourceGroup.id === targetGroup.id) return root;

  const { root: withoutSource } = removeLeaf(root, sourceLeafId);
  if (!withoutSource) return root;
  if (!findLeaf(withoutSource, targetLeafId)) return root;

  const direction: SplitNode["direction"] =
    zone === "left" || zone === "right" ? "horizontal" : "vertical";
  const after = zone === "right" || zone === "bottom";
  const newLeaf = createLeaf(sourceLeaf.sessionId, sourceLeaf.id);
  const newGroup = createTabs([newLeaf], newLeaf.id);
  return insertGroupBeside(withoutSource, targetGroup.id, newGroup, direction, after);
}

export function dropMissingSessions(root: PaneRoot, sessionIds: string[]): PaneRoot {
  if (!root) return null;

  if (root.type === "tabs") {
    const children = root.children.filter(
      (leaf) => leaf.sessionId === null || sessionIds.includes(leaf.sessionId),
    );
    if (children.length === root.children.length) return root;
    if (children.length === 0) return null;

    const activeLeafId = children.some((leaf) => leaf.id === root.activeLeafId)
      ? root.activeLeafId
      : children[0].id;
    return { ...root, children, activeLeafId };
  }

  const children: PaneNode[] = [];
  let changed = false;
  for (const child of root.children) {
    const next = dropMissingSessions(child, sessionIds);
    if (next !== child) changed = true;
    if (next) children.push(next);
  }

  if (!changed) return root;
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { ...root, children, sizes: distributeSizes(children.length) };
}

export function updateSplitSizes(root: PaneRoot, splitId: string, sizes: number[]): PaneRoot {
  if (!root) return root;
  if (root.type === "tabs") return root;
  if (root.id === splitId) {
    if (sizes.length !== root.children.length) return root;
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

export function focusPreset(sessionIds: string[]): TabsNode {
  const leaf = createLeaf(sessionIds[0] ?? null);
  return createTabs([leaf], leaf.id);
}

export function pairPreset(sessionIds: string[]): SplitNode {
  const groups = [0, 1].map((index) => {
    const leaf = createLeaf(sessionIds[index] ?? null);
    return createTabs([leaf], leaf.id);
  });
  return createSplit("horizontal", groups, [50, 50]);
}

export function gridPreset(sessionIds: string[]): SplitNode {
  const groups = [0, 1, 2, 3].map((index) => {
    const leaf = createLeaf(sessionIds[index] ?? null);
    return createTabs([leaf], leaf.id);
  });
  const top = createSplit("horizontal", [groups[0], groups[1]], [50, 50]);
  const bottom = createSplit("horizontal", [groups[2], groups[3]], [50, 50]);
  return createSplit("vertical", [top, bottom], [50, 50]);
}
