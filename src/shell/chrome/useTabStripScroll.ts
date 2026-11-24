import { useEffect, useState, type RefObject, type WheelEvent } from "react";

/** Room for a tab's close button and the faded edge of the strip. */
const EDGE = 28;

interface Span {
  left: number;
  right: number;
}

/** How far the strip has to scroll so that the tab is clear of both edges. */
export function revealOffset(strip: Span, tab: Span): number {
  if (tab.left < strip.left + EDGE) return tab.left - strip.left - EDGE;
  if (tab.right > strip.right - EDGE) return tab.right - strip.right + EDGE;
  return 0;
}

/** The distance a mouse wheel moves the strip; a sideways gesture scrolls it natively. */
export function wheelDistance(deltaX: number, deltaY: number): number {
  return Math.abs(deltaX) > Math.abs(deltaY) ? 0 : deltaY;
}

/// Keeps the active tab of the strip in view and reports whether the tabs fit.
export function useTabStripScroll(
  listRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  activeTabId: string | null,
) {
  const [overflowing, setOverflowing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const list = listRef.current;
    const content = contentRef.current;
    if (!list || !content) return;
    const measure = () => setOverflowing(list.scrollWidth > list.clientWidth);
    const reveal = () => {
      const tab = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!tab) return;
      list.scrollLeft += revealOffset(list.getBoundingClientRect(), tab.getBoundingClientRect());
    };
    const listObserver = new ResizeObserver(() => {
      measure();
      reveal();
    });
    // A tab that grows elsewhere must not pull the strip back while you look through it.
    const contentObserver = new ResizeObserver(measure);
    listObserver.observe(list);
    contentObserver.observe(content);
    return () => {
      listObserver.disconnect();
      contentObserver.disconnect();
    };
  }, [listRef, contentRef, activeTabId]);

  return {
    overflowing,
    scrolled,
    onScroll: () => setScrolled((listRef.current?.scrollLeft ?? 0) > 0),
    onWheel: (event: WheelEvent) => {
      if (listRef.current) listRef.current.scrollLeft += wheelDistance(event.deltaX, event.deltaY);
    },
  };
}
