import { collectLeaves } from "@/features/ai/panes/layout";
import type { PaneTreeEntry } from "@/features/ai/panes/store";
import type { Space } from "@/shared/stores/spaces/model";

export interface RailEntry {
  sessionId: string;
  leafId: string;
  tabId: string;
  /** 1-based position of the tab in the strip. */
  tabNumber: number;
}

export interface RailGroup {
  tabId: string;
  tabNumber: number;
  active: boolean;
  entries: RailEntry[];
}

/// The panes with a session of every agents tab, the active tab first, then the others in strip order.
export function railGroups(space: Space, trees: Record<string, PaneTreeEntry>): RailGroup[] {
  const groups = space.tabs.flatMap((tab, index): RailGroup[] => {
    if (tab.kind !== "agents") return [];
    const entries = collectLeaves(trees[tab.id]?.root ?? null).flatMap((leaf): RailEntry[] =>
      leaf.sessionId === null
        ? []
        : [{ sessionId: leaf.sessionId, leafId: leaf.id, tabId: tab.id, tabNumber: index + 1 }],
    );
    if (entries.length === 0) return [];
    return [{ tabId: tab.id, tabNumber: index + 1, active: tab.id === space.activeTabId, entries }];
  });
  return [...groups.filter((group) => group.active), ...groups.filter((group) => !group.active)];
}
