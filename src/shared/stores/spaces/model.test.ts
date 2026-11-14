import { describe, expect, it } from "vite-plus/test";

import {
  activateTabKind,
  activeTab,
  activeTabIdFor,
  addTab,
  addTabKinds,
  closeTab,
  codeTabId,
  createSpace,
  firstTabId,
  migrateOpenRepositories,
  renameTab,
  type Space,
} from "./model";

describe("space model", () => {
  it("gives the first tab of a folder a stable id across separators", () => {
    expect(firstTabId("C:\\work\\repo")).toBe(firstTabId("C:/work/repo"));
  });

  it("opens a space with an agents tab and a code tab", () => {
    const space = createSpace("/a", "s1");
    expect(space.tabs).toEqual([
      { id: firstTabId("/a"), name: "Agents", kind: "agents" },
      { id: codeTabId("/a"), name: "Code", kind: "code" },
    ]);
    expect(space.activeTabId).toBe(firstTabId("/a"));
    expect(createSpace("/a", "s1", "code").activeTabId).toBe(codeTabId("/a"));
  });

  it("finds the active tab of the space that holds a folder", () => {
    const space = addTab(createSpace("/a", "s1"), "Agents 2", "agents", "t3");
    expect(activeTabIdFor([space], "/a")).toBe("t3");
    expect(activeTabIdFor([space], "/b")).toBe(firstTabId("/b"));
  });

  it("activates the neighbor when the active tab closes and keeps the last tab", () => {
    let space = addTab(createSpace("/a", "s1"), "Agents 2", "agents", "t3");
    space = closeTab(space, "t3");
    expect(space.activeTabId).toBe(codeTabId("/a"));
    space = closeTab(closeTab(space, firstTabId("/a")), codeTabId("/a"));
    expect(space.tabs).toHaveLength(1);
  });

  it("activates a tab of a kind and adds one when the space has none", () => {
    const space = createSpace("/a", "s1");
    expect(activeTab(activateTabKind(space, "code"))?.id).toBe(codeTabId("/a"));
    expect(activateTabKind(space, "agents")).toBe(space);

    const withoutCode = closeTab(space, codeTabId("/a"));
    const restored = activateTabKind(withoutCode, "code");
    expect(restored.tabs.map((tab) => tab.kind)).toEqual(["agents", "code"]);
    expect(activeTab(restored)?.id).toBe(codeTabId("/a"));
  });

  it("ignores empty tab names", () => {
    const space = createSpace("/a", "s1");
    expect(renameTab(space, firstTabId("/a"), "   ")).toBe(space);
  });

  it("migrates open repositories and keeps an unknown active path inactive", () => {
    expect(migrateOpenRepositories(["/a"], "/elsewhere").activeSpaceId).toBeNull();
    const { spaces, activeSpaceId } = migrateOpenRepositories(["/a", "/b"], "/b", "code");
    expect(spaces.map((space) => space.folders)).toEqual([["/a"], ["/b"]]);
    expect(activeSpaceId).toBe(spaces[1].id);
    expect(spaces.every((space) => space.activeTabId === codeTabId(space.folders[0]))).toBe(true);
  });

  it("gives version 1 tabs a kind, adds the code tab and keeps the mode used before", () => {
    const legacy = {
      id: "s1",
      name: "a",
      folders: ["/a"],
      tabs: [
        { id: firstTabId("/a"), name: "Main" },
        { id: "t2", name: "Review" },
      ],
      activeTabId: firstTabId("/a"),
    } as unknown as Space;

    const [space] = addTabKinds({ spaces: [legacy], activeSpaceId: "s1" }, "code").spaces;

    expect(space.tabs).toEqual([
      { id: firstTabId("/a"), name: "Agents", kind: "agents" },
      { id: "t2", name: "Review", kind: "agents" },
      { id: codeTabId("/a"), name: "Code", kind: "code" },
    ]);
    expect(space.activeTabId).toBe(codeTabId("/a"));
  });
});
