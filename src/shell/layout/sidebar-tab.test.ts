import { describe, expect, it } from "vite-plus/test";

import { normalizeSidebar, normalizeSidebarTab } from "./sidebar-tab";

describe("normalizeSidebarTab", () => {
  it("maps the persisted agent tab to explorer", () => {
    expect(normalizeSidebarTab("agent")).toBe("explorer");
  });

  it("keeps the remaining tabs", () => {
    expect(normalizeSidebarTab("explorer")).toBe("explorer");
    expect(normalizeSidebarTab("debug")).toBe("debug");
    expect(normalizeSidebarTab("extensions")).toBe("extensions");
  });
});

describe("normalizeSidebar", () => {
  const docked = { position: "left" as const, width: 280, collapsed: false, tab: "git" as const };

  it("closes and unpins sidebars stored before the drawer", () => {
    expect(normalizeSidebar(docked)).toEqual({ ...docked, collapsed: true, pinned: false });
  });

  it("starts an unpinned drawer closed even when it was open", () => {
    expect(normalizeSidebar({ ...docked, pinned: false })).toEqual({
      ...docked,
      collapsed: true,
      pinned: false,
    });
  });

  it("keeps a sidebar the user pinned", () => {
    expect(normalizeSidebar({ ...docked, pinned: true })).toEqual({ ...docked, pinned: true });
  });
});
