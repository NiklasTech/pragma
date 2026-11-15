import {
  createSplit,
  createTabs,
  distributeSizes,
  type Leaf,
  type PaneNode,
  type PaneRoot,
  type SplitNode,
  type TabsNode,
} from "./operations";

export type SplitDirection = SplitNode["direction"];

function holds(node: PaneNode, leafId: string): boolean {
  return node.type === "tabs" && node.children.some((leaf) => leaf.id === leafId);
}

function groupFor(leaf: Leaf): TabsNode {
  return createTabs([leaf], leaf.id, `group-${leaf.id}`);
}

/** Places `leaf` after the pane of `targetLeafId`, side by side ("horizontal") or stacked. */
export function splitBeside(
  root: PaneRoot,
  targetLeafId: string,
  leaf: Leaf,
  direction: SplitDirection,
): PaneRoot {
  if (!root) return root;
  if (holds(root, targetLeafId)) return createSplit(direction, [root, groupFor(leaf)]);
  if (root.type === "tabs") return root;

  const index = root.children.findIndex((child) => holds(child, targetLeafId));
  if (index !== -1 && root.direction === direction) {
    // Same direction: the new pane takes half of the target's share instead of nesting.
    const half = (root.sizes[index] ?? 100 / root.children.length) / 2;
    const children = [...root.children];
    children.splice(index + 1, 0, groupFor(leaf));
    const sizes = [...root.sizes];
    sizes.splice(index, 1, half, half);
    return { ...root, children, sizes };
  }

  let changed = false;
  const children = root.children.map((child) => {
    const next = splitBeside(child, targetLeafId, leaf, direction) ?? child;
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

/** Removes a leaf; a split left with one pane gives way to that pane, and sizes are rescaled. */
export function removeLeaf(root: PaneRoot, leafId: string): PaneRoot {
  if (!root) return root;
  if (root.type === "tabs") {
    if (!holds(root, leafId)) return root;
    const children = root.children.filter((leaf) => leaf.id !== leafId);
    if (children.length === 0) return null;
    const activeLeafId = root.activeLeafId === leafId ? (children[0]?.id ?? "") : root.activeLeafId;
    return { ...root, children, activeLeafId };
  }

  const kept: PaneNode[] = [];
  const keptSizes: number[] = [];
  let changed = false;
  root.children.forEach((child, index) => {
    const next = removeLeaf(child, leafId);
    if (next !== child) changed = true;
    if (next) {
      kept.push(next);
      keptSizes.push(root.sizes[index] ?? 0);
    }
  });
  if (!changed) return root;
  if (kept.length === 0) return null;
  if (kept.length === 1) return kept[0];
  const total = keptSizes.reduce((sum, size) => sum + size, 0);
  const sizes =
    total > 0 ? keptSizes.map((size) => (size / total) * 100) : distributeSizes(kept.length);
  return { ...root, children: kept, sizes };
}

function groupOf(root: PaneRoot, leafId: string): TabsNode | null {
  if (!root) return null;
  if (root.type === "tabs") return holds(root, leafId) ? root : null;
  for (const child of root.children) {
    const found = groupOf(child, leafId);
    if (found) return found;
  }
  return null;
}

function replaceGroups(node: PaneNode, swap: Map<string, TabsNode>): PaneNode {
  if (node.type === "tabs") return swap.get(node.id) ?? node;
  return { ...node, children: node.children.map((child) => replaceGroups(child, swap)) };
}

/** Exchanges the places of two panes and leaves every split as it is. */
export function swapInPlace(root: PaneRoot, sourceLeafId: string, targetLeafId: string): PaneRoot {
  const source = groupOf(root, sourceLeafId);
  const target = groupOf(root, targetLeafId);
  if (!root || !source || !target || source === target) return root;
  return replaceGroups(
    root,
    new Map([
      [source.id, target],
      [target.id, source],
    ]),
  );
}

/** The direction for a new pane next to `leafId`: across the split that holds it. */
export function nextSplitDirection(root: PaneRoot, leafId: string): SplitDirection {
  const parent = (node: PaneRoot): SplitNode | null => {
    if (!node || node.type === "tabs") return null;
    if (node.children.some((child) => holds(child, leafId))) return node;
    for (const child of node.children) {
      const found = parent(child);
      if (found) return found;
    }
    return null;
  };
  return parent(root)?.direction === "horizontal" ? "vertical" : "horizontal";
}
