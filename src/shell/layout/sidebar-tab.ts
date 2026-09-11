import type { SidebarTab } from "./tree/types";

// The Agent dock tab was folded into the AI panel; persisted layouts may still reference it.
export function normalizeSidebarTab(tab: SidebarTab): SidebarTab {
  return tab === "agent" ? "explorer" : tab;
}
