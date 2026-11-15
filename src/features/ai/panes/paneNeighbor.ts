export type PaneDirection = "left" | "right" | "up" | "down";

export interface PaneRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlacedPane {
  id: string;
  rect: PaneRect;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * The pane to move to from `current` in a direction: it must lie past the current edge, and of
 * those the one sharing the most of the current edge wins, then the nearest one.
 */
export function pickNeighbor(
  current: PaneRect,
  panes: PlacedPane[],
  direction: PaneDirection,
): string | null {
  const horizontal = direction === "left" || direction === "right";
  const middle = horizontal
    ? (current.top + current.bottom) / 2
    : (current.left + current.right) / 2;
  let best: { id: string; shared: number; distance: number; offset: number } | null = null;

  for (const pane of panes) {
    const { rect } = pane;
    // A pane counts as past the edge when its center has crossed it.
    const centerX = (rect.left + rect.right) / 2;
    const centerY = (rect.top + rect.bottom) / 2;
    const ahead =
      (direction === "left" && centerX < current.left) ||
      (direction === "right" && centerX > current.right) ||
      (direction === "up" && centerY < current.top) ||
      (direction === "down" && centerY > current.bottom);
    if (!ahead) continue;

    const shared = horizontal
      ? overlap(rect.top, rect.bottom, current.top, current.bottom)
      : overlap(rect.left, rect.right, current.left, current.right);
    const distance = horizontal
      ? direction === "left"
        ? current.left - rect.right
        : rect.left - current.right
      : direction === "up"
        ? current.top - rect.bottom
        : rect.top - current.bottom;

    // On a tie, the pane whose middle lines up best with the current one wins.
    const offset = Math.abs((horizontal ? centerY : centerX) - middle);
    const better =
      !best ||
      (shared > 0 && best.shared === 0) ||
      (shared > 0 === best.shared > 0 &&
        (distance < best.distance ||
          (distance === best.distance &&
            (shared > best.shared || (shared === best.shared && offset < best.offset)))));
    if (better) best = { id: pane.id, shared, distance, offset };
  }

  return best?.id ?? null;
}
