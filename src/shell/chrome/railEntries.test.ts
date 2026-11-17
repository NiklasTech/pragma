import { describe, expect, it } from "vite-plus/test";

import type { PaneTreeEntry } from "@/features/ai/panes/store";
import type { Space } from "@/shared/stores/spaces/model";

import { railGroups } from "./railEntries";

function tree(...sessionIds: Array<string | null>): PaneTreeEntry {
  return {
    root: {
      type: "split",
      id: "split",
      direction: "horizontal",
      sizes: sessionIds.map(() => 1),
      children: sessionIds.map((sessionId, index) => ({
        type: "tabs" as const,
        id: `group-${index}`,
        activeLeafId: `leaf-${sessionId ?? index}`,
        children: [{ id: `leaf-${sessionId ?? index}`, sessionId }],
      })),
    },
    focusedLeafId: null,
    focusOrder: [],
  };
}

const space: Space = {
  id: "space",
  name: "Test",
  folders: ["/test"],
  tabs: [
    { id: "agents-1", name: "Agents", kind: "agents" },
    { id: "code", name: "Code", kind: "code" },
    { id: "agents-2", name: "Readme", kind: "agents" },
    { id: "agents-3", name: "Empty", kind: "agents" },
  ],
  activeTabId: "agents-2",
};

describe("railGroups", () => {
  it("puts the active tab first and keeps the strip numbers", () => {
    const groups = railGroups(space, {
      "agents-1": tree("a", "b"),
      "agents-2": tree("c"),
    });
    expect(groups.map((group) => [group.tabNumber, group.active])).toEqual([
      [3, true],
      [1, false],
    ]);
    expect(groups[1].entries.map((entry) => entry.sessionId)).toEqual(["a", "b"]);
  });

  it("skips empty panes, code tabs and tabs without sessions", () => {
    const groups = railGroups(space, {
      "agents-1": tree(null, "a"),
      "agents-3": tree(null),
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].entries).toEqual([
      { sessionId: "a", leafId: "leaf-a", tabId: "agents-1", tabNumber: 1 },
    ]);
  });
});
