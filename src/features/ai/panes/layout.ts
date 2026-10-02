import {
  createSplit,
  createTabs,
  findNode,
  type Leaf,
  type PaneNode,
  type PaneRoot,
} from "./operations";

export function collectLeaves(root: PaneRoot): Leaf[] {
  if (!root) return [];
  if (root.type === "tabs") return root.children;
  return root.children.flatMap((child) => collectLeaves(child));
}

/// Rows for a grid of `count` panes, favouring more columns than rows on wide screens.
export function gridRowCounts(count: number): number[] {
  if (count <= 0) return [];
  const rows = Math.max(1, Math.floor(Math.sqrt(count)));
  const columns = Math.ceil(count / rows);
  const counts: number[] = [];
  let remaining = count;
  while (remaining > 0) {
    const take = Math.min(columns, remaining);
    counts.push(take);
    remaining -= take;
  }
  return counts;
}

function keptSizes(previous: PaneRoot, id: string, count: number): number[] | undefined {
  const node = findNode(previous, id);
  return node?.type === "split" && node.children.length === count ? node.sizes : undefined;
}

function line(
  direction: "horizontal" | "vertical",
  nodes: PaneNode[],
  id: string,
  previous: PaneRoot,
): PaneNode {
  if (nodes.length === 1) return nodes[0];
  return createSplit(direction, nodes, keptSizes(previous, id, nodes.length), id);
}

/// Tiles the leaves in order as a grid with stable ids, keeping split sizes whose shape is unchanged.
export function autoLayout(leaves: Leaf[], previous: PaneRoot = null): PaneRoot {
  if (leaves.length === 0) return null;
  const groups: PaneNode[] = leaves.map((leaf) => createTabs([leaf], leaf.id, `group-${leaf.id}`));

  const rows: PaneNode[] = [];
  let offset = 0;
  for (const [index, count] of gridRowCounts(groups.length).entries()) {
    rows.push(line("horizontal", groups.slice(offset, offset + count), `row-${index}`, previous));
    offset += count;
  }
  return line("vertical", rows, "rows", previous);
}

/// Moves the leaf `sourceId` to the slot of `targetId` and the target leaf to the source slot.
export function swapLeaves(root: PaneRoot, sourceId: string, targetId: string): PaneRoot {
  const leaves = collectLeaves(root);
  const from = leaves.findIndex((leaf) => leaf.id === sourceId);
  const to = leaves.findIndex((leaf) => leaf.id === targetId);
  if (from === -1 || to === -1 || from === to) return root;
  const next = [...leaves];
  [next[from], next[to]] = [next[to], next[from]];
  return autoLayout(next, root);
}
