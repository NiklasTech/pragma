import { describe, expect, it } from "vite-plus/test";

import type { PaneTreeEntry } from "@/features/ai/panes/store";
import type { CommandPaletteItem } from "@/shared/stores/commandPalette";
import type { Space } from "@/shared/stores/spaces/model";

import { commandTarget, matchCommands } from "./commandLineLogic";

function tree(sessionId: string | null, focused = true): PaneTreeEntry {
  const leafId = `leaf-${sessionId ?? "empty"}`;
  return {
    root: {
      type: "tabs",
      id: "group",
      activeLeafId: leafId,
      children: [{ id: leafId, sessionId }],
    },
    focusedLeafId: focused ? leafId : null,
    focusOrder: [],
  };
}

const space: Space = {
  id: "space",
  name: "Test",
  folders: ["/test"],
  tabs: [
    { id: "agents", name: "Agents", kind: "agents" },
    { id: "code", name: "Code", kind: "code" },
    { id: "more", name: "More", kind: "agents" },
  ],
  activeTabId: "more",
};

describe("commandTarget", () => {
  it("talks to the focused pane of the agents tab on screen", () => {
    const target = commandTarget(space, { agents: tree("a"), more: tree("b") }, true);
    expect(target).toEqual({ sessionId: "b", leafId: "leaf-b", tabId: "more", tabNumber: 3 });
  });

  it("has no target when the tab on screen shows no session", () => {
    expect(commandTarget(space, { agents: tree("a"), more: tree(null) }, true)).toBeNull();
  });

  it("reaches the first agents tab with a focused session from the code tab", () => {
    const target = commandTarget(
      { ...space, activeTabId: "code" },
      { agents: tree("a", false), more: tree("b") },
      false,
    );
    expect(target?.sessionId).toBe("b");
  });
});

describe("matchCommands", () => {
  const command = (label: string, keywords?: string[]): CommandPaletteItem => ({
    id: label,
    label,
    category: "View",
    keywords,
    action: () => {},
  });
  const commands = [
    command("Toggle Terminal"),
    command("Split Right", ["pane"]),
    command("Open Settings"),
  ];

  it("keeps commands that contain every word, labels starting with it first", () => {
    expect(matchCommands(commands, "set").map((item) => item.label)).toEqual(["Open Settings"]);
    expect(matchCommands(commands, "pane").map((item) => item.label)).toEqual(["Split Right"]);
    expect(matchCommands(commands, "t").map((item) => item.label)).toEqual([
      "Toggle Terminal",
      "Open Settings",
      "Split Right",
    ]);
  });
});
