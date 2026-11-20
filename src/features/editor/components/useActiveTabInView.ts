import { useEffect, type RefObject } from "react";

/// Scrolls the tab list just enough that the active tab is visible, also when the editor narrows.
export function useActiveTabInView(
  listRef: RefObject<HTMLElement | null>,
  activeTabId: string | null,
  tabCount: number,
): void {
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const reveal = () => {
      const tab = list.querySelector<HTMLElement>('[data-active="true"]');
      if (!tab) return;
      const box = list.getBoundingClientRect();
      const rect = tab.getBoundingClientRect();
      if (rect.left < box.left) list.scrollLeft -= box.left - rect.left;
      else if (rect.right > box.right) list.scrollLeft += rect.right - box.right;
    };
    const observer = new ResizeObserver(reveal);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, activeTabId, tabCount]);
}
