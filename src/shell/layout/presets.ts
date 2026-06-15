import type { LayoutTreeState, TabsNode } from "./tree/types";
import { createPanel, createSplit, createTabs } from "./tree/operations";

const DEFAULT_FLOATING: LayoutTreeState["ai"]["floating"] = {
  x: 120,
  y: 80,
  width: 420,
  height: 520,
};

const DEFAULT_TERMINAL_FLOATING: LayoutTreeState["terminal"]["floating"] = {
  x: 160,
  y: 120,
  width: 700,
  height: 380,
};

function editorTabs(): TabsNode {
  return createTabs([createPanel("editor")]);
}

function terminalTabs(): TabsNode {
  return createTabs([createPanel("terminal")]);
}

export const layoutPresets: Record<string, LayoutTreeState> = {
  focused: {
    sidebar: {
      position: "left",
      width: 260,
      collapsed: true,
      tab: "explorer",
    },
    ai: { mode: "hidden", floating: { ...DEFAULT_FLOATING }, size: 360 },
    terminal: {
      mode: "hidden",
      height: 30,
      floating: { ...DEFAULT_TERMINAL_FLOATING },
    },
    root: editorTabs(),
    floating: [],
    activePreset: "focused",
    isCustomized: false,
  },

  classic: {
    sidebar: {
      position: "left",
      width: 260,
      collapsed: false,
      tab: "explorer",
    },
    ai: { mode: "hidden", floating: { ...DEFAULT_FLOATING }, size: 360 },
    terminal: {
      mode: "docked-bottom",
      height: 35,
      floating: { ...DEFAULT_TERMINAL_FLOATING },
    },
    root: createSplit("vertical", [editorTabs(), terminalTabs()], [65, 35]),
    floating: [],
    activePreset: "classic",
    isCustomized: false,
  },

  "ai-heavy": {
    sidebar: {
      position: "left",
      width: 220,
      collapsed: false,
      tab: "explorer",
    },
    ai: { mode: "drawer-right", floating: { ...DEFAULT_FLOATING }, size: 380 },
    terminal: {
      mode: "docked-bottom",
      height: 25,
      floating: { ...DEFAULT_TERMINAL_FLOATING },
    },
    root: createSplit("vertical", [editorTabs(), terminalTabs()], [75, 25]),
    floating: [],
    activePreset: "ai-heavy",
    isCustomized: false,
  },

  minimal: {
    sidebar: {
      position: "left",
      width: 260,
      collapsed: true,
      tab: "explorer",
    },
    ai: { mode: "floating", floating: { ...DEFAULT_FLOATING }, size: 360 },
    terminal: {
      mode: "hidden",
      height: 30,
      floating: { ...DEFAULT_TERMINAL_FLOATING },
    },
    root: editorTabs(),
    floating: [],
    activePreset: "minimal",
    isCustomized: false,
  },

  debug: {
    sidebar: {
      position: "right",
      width: 280,
      collapsed: false,
      tab: "git-status",
    },
    ai: { mode: "hidden", floating: { ...DEFAULT_FLOATING }, size: 360 },
    terminal: {
      mode: "docked-bottom",
      height: 45,
      floating: { ...DEFAULT_TERMINAL_FLOATING },
    },
    root: createSplit("vertical", [editorTabs(), terminalTabs()], [55, 45]),
    floating: [],
    activePreset: "debug",
    isCustomized: false,
  },
};

export const defaultPresetId = "classic";

export const presetLabels: Record<string, { name: string; description?: string }> = {
  focused: { name: "Focused", description: "Editor only, everything else hidden" },
  classic: { name: "Classic", description: "Sidebar, editor and terminal" },
  "ai-heavy": { name: "AI Heavy", description: "Sidebar and AI drawer with terminal" },
  minimal: { name: "Minimal", description: "Welcome screen with floating AI" },
  debug: { name: "Debug", description: "Terminal-heavy with sidebar on the right" },
};

export function getDefaultPreset(): LayoutTreeState {
  return layoutPresets[defaultPresetId];
}
