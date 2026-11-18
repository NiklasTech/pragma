import type { PaneTreeEntry } from "@/features/ai/panes/store";
import { findLeaf } from "@/features/ai/panes/operations";
import type { CommandPaletteItem } from "@/shared/stores/commandPalette";
import type { Space } from "@/shared/stores/spaces/model";

import type { RailEntry } from "../railEntries";

const MAX_COMMANDS = 8;

/// The pane the command line talks to: the focused pane of the agents tab on screen, else of the
/// first agents tab that has one, so the code tab still reaches the agent you worked with.
export function commandTarget(
  space: Space,
  trees: Record<string, PaneTreeEntry>,
  inAgents: boolean,
): RailEntry | null {
  const tabs = space.tabs
    .map((tab, index) => ({ tab, tabNumber: index + 1 }))
    .filter(({ tab }) => tab.kind === "agents");
  const ordered = inAgents ? tabs.filter(({ tab }) => tab.id === space.activeTabId) : tabs;
  for (const { tab, tabNumber } of ordered) {
    const entry = trees[tab.id];
    const leaf = entry?.focusedLeafId ? findLeaf(entry.root, entry.focusedLeafId) : null;
    if (leaf?.sessionId) {
      return { sessionId: leaf.sessionId, leafId: leaf.id, tabId: tab.id, tabNumber };
    }
  }
  return null;
}

/// Commands whose label or keywords contain every word of the query, best matches first.
export function matchCommands(
  commands: readonly CommandPaletteItem[],
  query: string,
): CommandPaletteItem[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const scored = commands.flatMap((command) => {
    const label = command.label.toLowerCase();
    const haystack = [label, command.category.toLowerCase(), ...(command.keywords ?? [])]
      .join(" ")
      .toLowerCase();
    if (!words.every((word) => haystack.includes(word))) return [];
    const score = words.length === 0 ? 0 : label.startsWith(words[0]) ? 0 : 1;
    return [{ command, score }];
  });
  return scored
    .sort((a, b) => a.score - b.score || a.command.label.localeCompare(b.command.label))
    .slice(0, MAX_COMMANDS)
    .map(({ command }) => command);
}
