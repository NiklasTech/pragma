import {
  countLeaves,
  createLeaf,
  createTabs,
  findLeafBySession,
  findLeafGroup,
  findParentOfNode,
  firstGroup,
  focusLeaf,
  insertBeside,
  MAX_PANES,
  type PaneNode,
  type PaneRoot,
  type SplitNode,
} from "./operations";

/// Width to height ratio assumed for the Agents area when it cannot be measured.
export const DEFAULT_PANE_ASPECT = 1.6;

const DIRECTIONS: SplitNode["direction"][] = ["horizontal", "vertical"];

function smallestSide(node: PaneNode, width: number, height: number): number {
  if (node.type === "tabs") return Math.min(width, height);
  return node.children.reduce((smallest, child, index) => {
    const share = (node.sizes[index] ?? 100 / node.children.length) / 100;
    const side =
      node.direction === "horizontal"
        ? smallestSide(child, width * share, height)
        : smallestSide(child, width, height * share);
    return Math.min(smallest, side);
  }, Number.POSITIVE_INFINITY);
}

/// Places `node` next to the group or one of its ancestors, keeping the smallest pane as large as possible.
export function placeBeside(
  root: PaneNode,
  groupId: string,
  node: PaneNode,
  aspect = DEFAULT_PANE_ASPECT,
): PaneNode {
  const anchors = [groupId];
  for (let parent = findParentOfNode(root, groupId); parent;) {
    anchors.push(parent.split.id);
    parent = findParentOfNode(root, parent.split.id);
  }

  let best = root;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const anchor of anchors) {
    for (const direction of DIRECTIONS) {
      const candidate = insertBeside(root, anchor, node, direction, true);
      const score = smallestSide(candidate, aspect, 1);
      if (score > bestScore + 1e-6) {
        best = candidate;
        bestScore = score;
      }
    }
  }
  return best;
}

/// Shows a session in its own pane beside the focused one; an open session only gets focus.
export function openSession(
  root: PaneRoot,
  focusedLeafId: string | null,
  sessionId: string,
  aspect = DEFAULT_PANE_ASPECT,
): { root: PaneRoot; focusedLeafId: string | null } {
  const existing = findLeafBySession(root, sessionId);
  if (existing) {
    return { root: focusLeaf(root, existing.id), focusedLeafId: existing.id };
  }

  if (countLeaves(root) >= MAX_PANES) {
    return { root, focusedLeafId };
  }

  const leaf = createLeaf(sessionId);
  const group = createTabs([leaf], leaf.id);
  const anchor = root
    ? ((focusedLeafId ? findLeafGroup(root, focusedLeafId) : null) ?? firstGroup(root))
    : null;
  if (!root || !anchor) return { root: group, focusedLeafId: leaf.id };

  return { root: placeBeside(root, anchor.id, group, aspect), focusedLeafId: leaf.id };
}

/// Width to height ratio of the rendered pane area, or the default before it is mounted.
export function measurePaneAspect(): number {
  if (typeof document === "undefined") return DEFAULT_PANE_ASPECT;
  const rect = document.querySelector("[data-pane-tree]")?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return DEFAULT_PANE_ASPECT;
  return rect.width / rect.height;
}
