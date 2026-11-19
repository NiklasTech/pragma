import { useEffect, type RefObject } from "react";

/// Scrolls the tab list just enough that the active tab is visible, like a newly opened file.
export function useActiveTabInView(
  listRef: RefObject<HTMLElement | null>,
  activeTabId: string | null,
  tabCount: number,
): void {
  useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[data-active="true"]');
    if (!list || !tab) return;
    const box = list.getBoundingClientRect();
    const rect = tab.getBoundingClientRect();
    if (rect.left < box.left) list.scrollLeft -= box.left - rect.left;
    else if (rect.right > box.right) list.scrollLeft += rect.right - box.right;
  }, [listRef, activeTabId, tabCount]);
}
