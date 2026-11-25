import { describe, expect, it, vi } from "vite-plus/test";

import type { Space } from "@/shared/stores/spaces/model";

import { spaceTabMenu } from "./spaceTabMenu";

const space: Space = {
  id: "s",
  name: "pragma",
  folders: ["/p"],
  activeTabId: "a",
  tabs: [
    { id: "a", name: "Agents", kind: "agents" },
    { id: "c", name: "Code", kind: "code" },
    { id: "x", name: "Activity", kind: "activity" },
  ],
};

function actions() {
  return {
    rename: vi.fn(),
    newAgentsTab: vi.fn(),
    showCode: vi.fn(),
    showActivity: vi.fn(),
    close: vi.fn(),
    evenOut: vi.fn(),
    saveLayout: vi.fn(),
  };
}

describe("spaceTabMenu", () => {
  it("names the tab and leaves out the kind it already is", () => {
    const menu = spaceTabMenu(space, space.tabs[1], actions());
    const labels = menu.groups.flatMap((group) => group.items.map((item) => item.label));
    expect(menu.head).toBe("tab 2 · Code · pragma");
    expect(labels).not.toContain("show code tab");
    expect(labels).toContain("show activity tab");
  });

  it("evens out and saves the panes of an agents tab only", () => {
    const labels = (index: number) =>
      spaceTabMenu(space, space.tabs[index], actions()).groups.flatMap((group) =>
        group.items.map((item) => item.label),
      );
    expect(labels(0)).toEqual(expect.arrayContaining(["even out panes", "save as layout"]));
    expect(labels(1)).not.toContain("even out panes");
  });

  it("closes the other tabs and the ones to the right", () => {
    const run = actions();
    const menu = spaceTabMenu(space, space.tabs[0], run);
    const items = menu.groups.flatMap((group) => group.items);
    items.find((item) => item.label === "close tabs to the right")?.onSelect();
    expect(run.close.mock.calls.map((call) => call[0])).toEqual([["c", "x"]]);
    run.close.mockClear();
    items.find((item) => item.label === "close other tabs")?.onSelect();
    expect(run.close.mock.calls.map((call) => call[0])).toEqual([["c", "x"]]);
  });

  it("cannot close the only tab", () => {
    const single = { ...space, tabs: [space.tabs[0]] };
    const items = spaceTabMenu(single, single.tabs[0], actions()).groups.flatMap(
      (group) => group.items,
    );
    expect(items.find((item) => item.label === "close")?.disabled).toBe(true);
  });
});
