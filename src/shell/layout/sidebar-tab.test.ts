import { describe, expect, it } from "vite-plus/test";

import { normalizeSidebarTab } from "./sidebar-tab";

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
