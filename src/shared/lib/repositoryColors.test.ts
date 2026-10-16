import { describe, expect, it } from "vite-plus/test";
import { mergeWithDefaults } from "@/shared/stores/settings/migrations";
import { useSettingsStore } from "@/shared/stores/settings";
import {
  assignRepositoryColors,
  REPOSITORY_COLOR_DEFAULTS,
  REPOSITORY_PALETTE,
  repositoryAccent,
  repositoryColorEntry,
  visibleRepositoryColor,
  withRepositoryColor,
  type RepositoryColorMap,
} from "./repositoryColors";

const [first, second, third] = REPOSITORY_PALETTE;

describe("repository color assignment", () => {
  it("hands out palette colors in the order repositories were opened", () => {
    const byPath = assignRepositoryColors(["/a", "/b", "/c"], {}) as RepositoryColorMap;
    expect(repositoryColorEntry(byPath, "/a")).toEqual({ color: first, chosen: false });
    expect(repositoryColorEntry(byPath, "/b")?.color).toBe(second);
    expect(repositoryColorEntry(byPath, "/c")?.color).toBe(third);
  });

  it("keeps colors when another repository closes and skips colors in use", () => {
    const opened = assignRepositoryColors(["/a", "/b"], {}) as RepositoryColorMap;
    const afterClose = assignRepositoryColors(["/b"], opened);
    expect(afterClose).toBeNull();
    const reopened = assignRepositoryColors(["/b", "/c"], opened) as RepositoryColorMap;
    expect(repositoryColorEntry(reopened, "/b")?.color).toBe(second);
    expect(repositoryColorEntry(reopened, "/c")?.color).toBe(first);
  });

  it("does not reuse a color the user picked for another open repository", () => {
    const byPath = withRepositoryColor({}, "/a", first);
    const assigned = assignRepositoryColors(["/a", "/b"], byPath) as RepositoryColorMap;
    expect(repositoryColorEntry(assigned, "/b")?.color).toBe(second);
  });

  it("returns null when every open repository has a color", () => {
    const byPath = assignRepositoryColors(["/a"], {}) as RepositoryColorMap;
    expect(assignRepositoryColors(["/a"], byPath)).toBeNull();
  });

  it("cycles once the palette runs out", () => {
    const paths = Array.from({ length: REPOSITORY_PALETTE.length + 1 }, (_, i) => `/r${i}`);
    const byPath = assignRepositoryColors(paths, {}) as RepositoryColorMap;
    expect(repositoryColorEntry(byPath, paths[paths.length - 1])?.color).toBeTruthy();
  });
});

describe("repository colors per path", () => {
  it("stores colors by normalized path", () => {
    const byPath = withRepositoryColor({}, "/work/app/", "#123456");
    expect(repositoryColorEntry(byPath, "/work/app")).toEqual({ color: "#123456", chosen: true });
    expect(repositoryColorEntry(byPath, "/work//app")?.color).toBe("#123456");
  });

  it("removes a picked color to go back to automatic", () => {
    const byPath = withRepositoryColor(withRepositoryColor({}, "/a", "#123456"), "/a", null);
    expect(repositoryColorEntry(byPath, "/a")).toBeNull();
  });

  it("survives a restart through the persisted settings", () => {
    const byPath = withRepositoryColor({}, "/a", "#123456");
    const restored = mergeWithDefaults(
      { repositoryColors: { byPath, useAsAccent: true } },
      useSettingsStore.getState(),
    );
    expect(restored.repositoryColors).toEqual({ byPath, useAsAccent: true });
  });

  it("defaults to no colors and no accent", () => {
    expect(useSettingsStore.getState().repositoryColors).toEqual(REPOSITORY_COLOR_DEFAULTS);
  });
});

describe("repository color visibility", () => {
  it("hides automatic colors while only one repository is open", () => {
    const byPath = assignRepositoryColors(["/a"], {}) as RepositoryColorMap;
    expect(visibleRepositoryColor(byPath, "/a", 1)).toBeNull();
    expect(visibleRepositoryColor(byPath, "/a", 2)).toBe(first);
  });

  it("shows a picked color even with one repository", () => {
    const byPath = withRepositoryColor({}, "/a", "#123456");
    expect(visibleRepositoryColor(byPath, "/a", 1)).toBe("#123456");
  });
});

describe("repository color as accent", () => {
  const byPath = assignRepositoryColors(["/a", "/b"], {}) as RepositoryColorMap;

  it("follows the active repository when turned on", () => {
    const settings = { byPath, useAsAccent: true };
    expect(repositoryAccent(settings, "/a")).toBe(first);
    expect(repositoryAccent(settings, "/b")).toBe(second);
  });

  it("leaves the accent alone when off or nothing is active", () => {
    expect(repositoryAccent({ byPath, useAsAccent: false }, "/a")).toBe("");
    expect(repositoryAccent({ byPath, useAsAccent: true }, null)).toBe("");
    expect(repositoryAccent({ byPath, useAsAccent: true }, "/unknown")).toBe("");
  });
});
