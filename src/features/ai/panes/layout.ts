import { createSplit, createTabs, type Leaf, type PaneNode, type PaneRoot } from "./operations";

export type PaneArrangement = "grid" | "columns" | "rows";

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

function line(direction: "horizontal" | "vertical", nodes: PaneNode[]): PaneNode {
  return nodes.length === 1 ? nodes[0] : createSplit(direction, nodes);
}

export function buildLayout(leaves: Leaf[], arrangement: PaneArrangement): PaneRoot {
  if (leaves.length === 0) return null;
  const groups: PaneNode[] = leaves.map((leaf) => createTabs([leaf], leaf.id));
  if (arrangement === "columns") return line("horizontal", groups);
  if (arrangement === "rows") return line("vertical", groups);

  const rows: PaneNode[] = [];
  let offset = 0;
  for (const count of gridRowCounts(groups.length)) {
    rows.push(line("horizontal", groups.slice(offset, offset + count)));
    offset += count;
  }
  return line("vertical", rows);
}

/// Gives every open pane its own group and tiles them, keeping each leaf and its id.
export function arrangeLeaves(root: PaneRoot, arrangement: PaneArrangement): PaneRoot {
  return buildLayout(collectLeaves(root), arrangement);
}
