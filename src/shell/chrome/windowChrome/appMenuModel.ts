import type { ShortcutActionId } from "@/shared/lib/shortcuts";

/** A view the menu shows as checked while it is open. */
export type MenuToggle = "sidebar" | "terminal" | "ai";

export type AppMenuEntry =
  | {
      kind: "action";
      id: ShortcutActionId | "app.checkForUpdates" | "app.openGitHub";
      label: string;
    }
  | { kind: "toggle"; id: ShortcutActionId; label: string; toggle: MenuToggle }
  | { kind: "recent" }
  | { kind: "separator" };

export interface AppMenuGroup {
  label: string;
  entries: readonly AppMenuEntry[];
}

const action = (id: ShortcutActionId, label: string): AppMenuEntry => ({
  kind: "action",
  id,
  label,
});
const separator: AppMenuEntry = { kind: "separator" };

/// The macOS menu bar, for Windows and Linux where Pragma draws the window chrome itself.
export const APP_MENU_GROUPS: readonly AppMenuGroup[] = [
  {
    label: "File",
    entries: [
      action("session.quickStart", "New Task..."),
      separator,
      action("file.open", "Open File"),
      action("file.openFolder", "Open Folder"),
      { kind: "recent" },
      separator,
      action("file.save", "Save"),
      separator,
      action("file.closeTab", "Close Tab"),
      action("file.reopenClosedTab", "Reopen Closed Tab"),
    ],
  },
  {
    label: "Edit",
    entries: [
      action("search.find", "Find"),
      action("search.replace", "Replace"),
      action("search.findInFiles", "Find in Files"),
      separator,
      action("editor.formatDocument", "Format Document"),
      action("edit.editWithAI", "Edit Selection with AI"),
    ],
  },
  {
    label: "View",
    entries: [
      action("view.commandPalette", "Command Palette"),
      separator,
      { kind: "toggle", id: "view.toggleSidebar", label: "Sidebar", toggle: "sidebar" },
      { kind: "toggle", id: "view.toggleTerminal", label: "Terminal", toggle: "terminal" },
      { kind: "toggle", id: "ai.toggle", label: "AI Chat", toggle: "ai" },
      action("view.showActivity", "Show Activity"),
      action("view.toggleProblems", "Toggle Problems"),
      action("view.togglePreview", "Toggle Preview"),
      action("view.splitEditor", "Split Editor"),
      separator,
      action("view.switchToAgents", "Show Agents Tab"),
      action("view.switchToEditor", "Show Code Tab"),
      action("view.toggleUiMode", "Switch Between Agents and Code"),
    ],
  },
  {
    label: "Panes",
    entries: [
      action("pane.splitRight", "Split Pane Right"),
      action("pane.splitDown", "Split Pane Down"),
      action("pane.toggleZoom", "Zoom Pane"),
      separator,
      action("pane.focusLeft", "Focus Pane Left"),
      action("pane.focusRight", "Focus Pane Right"),
      action("pane.focusUp", "Focus Pane Above"),
      action("pane.focusDown", "Focus Pane Below"),
    ],
  },
  {
    label: "Go",
    entries: [
      action("file.goToFile", "Go to File"),
      action("view.gitHistory", "Git History"),
      action("tab.next", "Next Tab"),
      action("tab.prev", "Previous Tab"),
    ],
  },
  {
    label: "Run",
    entries: [
      action("debug.currentFile", "Start / Continue"),
      action("debug.stop", "Stop"),
      action("debug.attach", "Attach to Process..."),
      separator,
      action("debug.stepOver", "Step Over"),
      action("debug.stepInto", "Step Into"),
      action("debug.stepOut", "Step Out"),
      separator,
      action("debug.toggleBreakpoint", "Toggle Breakpoint"),
    ],
  },
  {
    label: "Terminal",
    entries: [
      action("view.newTerminalTab", "New Terminal Tab"),
      action("view.toggleTerminal", "Toggle Terminal"),
    ],
  },
];

/** What the menu lists below the groups, as the Pragma menu does on macOS. */
export const APP_MENU_FOOTER: readonly AppMenuEntry[] = [
  action("view.openSettings", "Settings"),
  { kind: "action", id: "app.checkForUpdates", label: "Check for Updates" },
  { kind: "action", id: "app.openGitHub", label: "Pragma on GitHub" },
];
