import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  rangeSelection,
  selectionTargets,
  topLevelPaths,
  useFileSelectionStore,
} from "./fileSelection";

const visible = ["/w/a", "/w/a/one.ts", "/w/b.ts", "/w/c.ts"];

describe("rangeSelection", () => {
  it("selects every visible row between anchor and target in either direction", () => {
    expect(rangeSelection(visible, "/w/a/one.ts", "/w/c.ts")).toEqual([
      "/w/a/one.ts",
      "/w/b.ts",
      "/w/c.ts",
    ]);
    expect(rangeSelection(visible, "/w/c.ts", "/w/b.ts")).toEqual(["/w/b.ts", "/w/c.ts"]);
  });

  it("falls back to the target when the anchor is no longer visible", () => {
    expect(rangeSelection(visible, "/w/gone.ts", "/w/b.ts")).toEqual(["/w/b.ts"]);
  });
});

describe("topLevelPaths", () => {
  it("drops paths covered by a selected folder", () => {
    expect(topLevelPaths(["/w/a/one.ts", "/w/a", "/w/ab.ts"])).toEqual(["/w/a", "/w/ab.ts"]);
  });
});

describe("selectionTargets", () => {
  it("acts on the selection only when the row is part of it", () => {
    expect(selectionTargets("/w/b.ts", ["/w/b.ts", "/w/c.ts"])).toEqual(["/w/b.ts", "/w/c.ts"]);
    expect(selectionTargets("/w/a", ["/w/b.ts", "/w/c.ts"])).toEqual(["/w/a"]);
    expect(selectionTargets("/w/b.ts", ["/w/b.ts"])).toEqual(["/w/b.ts"]);
  });
});

describe("useFileSelectionStore", () => {
  beforeEach(() => useFileSelectionStore.getState().reset(null));

  it("starts a toggle selection from the plainly clicked row", () => {
    const store = useFileSelectionStore.getState();
    store.reset("/w/b.ts");
    store.toggle("/w/c.ts");
    expect(useFileSelectionStore.getState().paths).toEqual(["/w/b.ts", "/w/c.ts"]);

    useFileSelectionStore.getState().toggle("/w/b.ts");
    expect(useFileSelectionStore.getState().paths).toEqual(["/w/c.ts"]);
  });

  it("extends a range from the anchor", () => {
    const store = useFileSelectionStore.getState();
    store.reset("/w/a/one.ts");
    store.extend("/w/c.ts", visible);
    expect(useFileSelectionStore.getState().paths).toEqual(["/w/a/one.ts", "/w/b.ts", "/w/c.ts"]);
  });
});
