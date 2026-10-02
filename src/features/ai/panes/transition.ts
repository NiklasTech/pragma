import { flushSync } from "react-dom";

const DURATION_MS = 220;
const EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const RADIUS = "8px";

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

/// Applies a pane layout change and slides every card from its old place (FLIP), without snapshots.
export function animatePanes(update: () => void): void {
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
      card.animate(
        [
          { opacity: 0, transform: "scale(0.97)" },
          { opacity: 1, transform: "none" },
        ],
        timing,
      );
      continue;
    }
    // A growing maximized card is revealed from its old slot, so the terminal never scales.
    if (card.dataset.paneMaximized === "true" && first.width < last.width) {
      card.animate(
        [{ clipPath: insetBetween(last, first) }, { clipPath: `inset(0px round ${RADIUS})` }],
        timing,
      );
      continue;
    }
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], timing);
  }
}

/// Shrinks the maximized card back onto its grid slot, then applies the restore.
export function animateRestore(card: HTMLElement | null, update: () => void): void {
  const slot = card?.parentElement?.getBoundingClientRect();
  if (!card || !slot || !canAnimate()) {
    update();
    return;
  }
  const animation = card.animate(
    [
      { clipPath: `inset(0px round ${RADIUS})` },
      { clipPath: insetBetween(card.getBoundingClientRect(), slot) },
    ],
    { duration: DURATION_MS, easing: EASING, fill: "forwards" },
  );
  animation.onfinish = () => {
    flushSync(update);
    animation.cancel();
  };
}
