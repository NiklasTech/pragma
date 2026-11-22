import {
  SHORTCUT_ACTIONS,
  formatShortcut,
  getDefaultShortcuts,
  type ShortcutActionId,
} from "../src/shared/lib/shortcuts";

export interface ShortcutRow {
  label: string;
  mac: string;
  other: string;
}

export interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

const GROUPS: { title: string; match: (id: string) => boolean }[] = [
  {
    title: "Tabs and tasks",
    match: (id) =>
      id.startsWith("tab.") ||
      id === "session.quickStart" ||
      id.startsWith("view.switch") ||
      id === "view.toggleUiMode" ||
      id === "view.showActivity" ||
      id === "view.focusCommandLine" ||
      id === "view.commandPalette" ||
      id === "view.openSettings",
  },
  { title: "Agent panes", match: (id) => id.startsWith("pane.") },
  { title: "Files", match: (id) => id.startsWith("file.") },
  {
    title: "Editor",
    match: (id) =>
      id.startsWith("edit") ||
      id === "view.splitEditor" ||
      id === "view.toggleProblems" ||
      id === "view.togglePreview" ||
      id === "view.toggleSidebar" ||
      id === "view.gitHistory",
  },
  { title: "Search", match: (id) => id.startsWith("search.") },
  {
    title: "Terminal",
    match: (id) =>
      id.startsWith("terminal.") || id === "view.toggleTerminal" || id === "view.newTerminalTab",
  },
  {
    title: "AI and chat",
    match: (id) =>
      id.startsWith("ai.") ||
      id.startsWith("chat.") ||
      id.startsWith("voice.") ||
      id.startsWith("agent."),
  },
  { title: "Debugging", match: (id) => id.startsWith("debug.") },
];

const ARROWS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
};

function pretty(text: string, isMac: boolean): string {
  let result = text;
  for (const [name, arrow] of Object.entries(ARROWS)) result = result.replace(name, arrow);
  if (isMac) result = result.replace("Enter", "⏎");
  return result === "None" ? "" : result;
}

/// The default keymap of the app, grouped for the docs; built from the same table the app uses.
export default {
  load(): ShortcutGroup[] {
    const mac = getDefaultShortcuts(true);
    const other = getDefaultShortcuts(false);
    const groups: ShortcutGroup[] = [
      ...GROUPS.map(({ title }) => ({ title, rows: [] as ShortcutRow[] })),
      { title: "Other", rows: [] },
    ];
    let tabsAdded = false;
    for (const action of SHORTCUT_ACTIONS) {
      const id = action.id as ShortcutActionId;
      const index = GROUPS.findIndex((group) => group.match(id));
      const group = groups[index === -1 ? groups.length - 1 : index];
      if (id.startsWith("tab.select")) {
        if (tabsAdded) continue;
        tabsAdded = true;
        const range = (map: typeof mac, isMac: boolean) =>
          `${pretty(formatShortcut(map["tab.select1"], isMac), isMac)} … ${pretty(formatShortcut(map["tab.select9"], isMac), isMac)}`;
        group.rows.push({
          label: "Go to Tab 1 to 9",
          mac: range(mac, true),
          other: range(other, false),
        });
        continue;
      }
      group.rows.push({
        label: action.label,
        mac: pretty(formatShortcut(mac[id], true), true),
        other: pretty(formatShortcut(other[id], false), false),
      });
    }
    return groups.filter((group) => group.rows.length > 0);
  },
};
