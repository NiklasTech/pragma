import { describe, expect, it } from "vite-plus/test";

import {
  activeTabIdFor,
  addTab,
  closeTab,
  createSpace,
  firstTabId,
  migrateOpenRepositories,
  renameTab,
} from "./model";

describe("space model", () => {
  it("gives the first tab of a folder a stable id across separators", () => {
    expect(firstTabId("C:\\work\\repo")).toBe(firstTabId("C:/work/repo"));
  });

  it("finds the active tab of the space that holds a folder", () => {
    const space = addTab(createSpace("/a", "s1"), "Agents", "t2");
    expect(activeTabIdFor([space], "/a")).toBe("t2");
    expect(activeTabIdFor([space], "/b")).toBe(firstTabId("/b"));
  });

  it("activates the neighbor when the active tab closes", () => {
    let space = addTab(addTab(createSpace("/a", "s1"), "Two", "t2"), "Three", "t3");
    space = closeTab(space, "t3");
    expect(space.activeTabId).toBe("t2");
    expect(space.tabs.map((tab) => tab.id)).toEqual([firstTabId("/a"), "t2"]);
  });

  it("ignores empty tab names", () => {
    const space = createSpace("/a", "s1");
    expect(renameTab(space, firstTabId("/a"), "   ")).toBe(space);
  });

  it("migrates open repositories and keeps an unknown active path inactive", () => {
    expect(migrateOpenRepositories(["/a"], "/elsewhere").activeSpaceId).toBeNull();
    const { spaces, activeSpaceId } = migrateOpenRepositories(["/a", "/b"], "/b");
    expect(spaces.map((space) => space.folders)).toEqual([["/a"], ["/b"]]);
    expect(activeSpaceId).toBe(spaces[1].id);
  });
});
