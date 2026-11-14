import type { SidebarState, SidebarTab } from "./tree/types";

// The Agent dock tab was folded into the AI panel; persisted layouts may still reference it.
export function normalizeSidebarTab(tab: SidebarTab): SidebarTab {
  return tab === "agent" ? "explorer" : tab;
}

type StoredSidebar = Omit<SidebarState, "pinned"> & { pinned?: boolean };

/// Stored sidebars before the drawer were always docked; they now start unpinned. The drawer is
/// transient, so an unpinned sidebar always starts closed.
export function normalizeSidebar(sidebar: StoredSidebar): SidebarState {
  const tab = normalizeSidebarTab(sidebar.tab);
  if (sidebar.pinned === true) return { ...sidebar, tab, pinned: true };
  return { ...sidebar, tab, pinned: false, collapsed: true };
}
