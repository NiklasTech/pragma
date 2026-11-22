import { flushSync } from "react-dom";

const DURATION_MS = 220;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const RADIUS = "8px";
// Zooming moves a whole pane across the grid, so it gets a calmer curve than layout shifts.
const ZOOM = { duration: 340, easing: "cubic-bezier(0.32, 0.72, 0, 1)" };
const RECEDED: Keyframe = { opacity: 0.55, transform: "scale(0.985)" };
const PRESENT: Keyframe = { opacity: 1, transform: "none" };

function canAnimate(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof Element.prototype.animate === "function" &&
    !(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false)
  );
}

function paneCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-pane-leaf]"));
}

function insetBetween(outer: DOMRect, inner: DOMRect): string {
  const top = inner.top - outer.top;
  const right = outer.right - inner.right;
  const bottom = outer.bottom - inner.bottom;
  const left = inner.left - outer.left;
  return `inset(${top}px ${right}px ${bottom}px ${left}px round ${RADIUS})`;
}

const EXIT_MS = 150;
// How far a split pane travels as it slides out of the pane it was split from.
const ENTER_OFFSET_PX = 18;

export interface PaneEnter {
  leafId: string;
  /** The side the new pane grows from: it was split off the pane on that side. */
  from: "left" | "top";
}

function enterKeyframes(enter: PaneEnter | undefined, leafId: string | undefined): Keyframe[] {
  if (enter && enter.leafId === leafId) {
    const offset =
      enter.from === "left"
        ? `translateX(-${ENTER_OFFSET_PX}px)`
        : `translateY(-${ENTER_OFFSET_PX}px)`;
    return [
      { opacity: 0, transform: offset },
      { opacity: 1, transform: "none" },
    ];
  }
  return [
    { opacity: 0, transform: "scale(0.97)" },
    { opacity: 1, transform: "none" },
  ];
}

/// Applies a pane layout change and slides every card from its old place (FLIP), without snapshots.
export function animatePanes(update: () => void, enter?: PaneEnter): void {
  if (!canAnimate()) {
    update();
    return;
  }

  const before = new Map(
    paneCards().map((card) => [card.dataset.paneLeaf, card.getBoundingClientRect()]),
  );
  flushSync(update);

  for (const card of paneCards()) {
    const first = before.get(card.dataset.paneLeaf);
    const last = card.getBoundingClientRect();
    const timing = { duration: DURATION_MS, easing: EASING };

    if (!first) {
      card.animate(enterKeyframes(enter, card.dataset.paneLeaf), timing);
      continue;
    }
    // A growing maximized card is revealed from its old slot, so the terminal never scales.
    if (card.dataset.paneMaximized === "true" && first.width < last.width) {
      card.animate(
        [{ clipPath: insetBetween(last, first) }, { clipPath: `inset(0px round ${RADIUS})` }],
        ZOOM,
      );
      for (const other of paneCards()) {
        if (other !== card) other.animate([PRESENT, RECEDED], ZOOM);
      }
      break;
    }
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], timing);
  }
}

const restoring = new WeakSet<HTMLElement>();

/// Shrinks the maximized card back onto its grid slot while the others step forward, then applies the restore.
export function animateRestore(card: HTMLElement | null, update: () => void): void {
  const slot = card?.parentElement?.getBoundingClientRect();
  if (!card || !slot || !canAnimate()) {
    update();
    return;
  }
  // A second press while it shrinks would apply the restore twice and zoom the pane again.
  if (restoring.has(card)) return;
  restoring.add(card);
  for (const other of paneCards()) {
    if (other !== card) other.animate([RECEDED, PRESENT], ZOOM);
  }
  const animation = card.animate(
    [
      { clipPath: `inset(0px round ${RADIUS})` },
      { clipPath: insetBetween(card.getBoundingClientRect(), slot) },
    ],
    { ...ZOOM, fill: "forwards" },
  );
  animation.onfinish = () => {
    flushSync(update);
    animation.cancel();
    restoring.delete(card);
  };
}

/// Fades a closing card out on its place, then applies the change so the others slide over.
export function animatePaneExit(leafId: string, update: () => void): void {
  const card = canAnimate()
    ? document.querySelector<HTMLElement>(`[data-pane-leaf="${CSS.escape(leafId)}"]`)
    : null;
  if (!card) {
    animatePanes(update);
    return;
  }
  const animation = card.animate(
    [
      { opacity: 1, transform: "none" },
      { opacity: 0, transform: "scale(0.97)" },
    ],
    { duration: EXIT_MS, easing: EASING, fill: "forwards" },
  );
  animation.onfinish = () => animatePanes(update);
}
