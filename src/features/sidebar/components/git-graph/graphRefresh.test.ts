import { describe, expect, it } from "vite-plus/test";
import { PAGE_SIZE } from "./constants";
import { refreshLimit, shouldRefreshGraph } from "./graphRefresh";

describe("shouldRefreshGraph", () => {
  const snapshot = { ahead: 0 };

  it("does not reload after a finished load when the snapshot is unchanged", () => {
    expect(shouldRefreshGraph(snapshot, snapshot, PAGE_SIZE)).toBe(false);
    expect(shouldRefreshGraph(snapshot, snapshot, PAGE_SIZE * 2)).toBe(false);
  });

  it("reloads once when the repository snapshot changes", () => {
    expect(shouldRefreshGraph(snapshot, { ahead: 1 }, PAGE_SIZE)).toBe(true);
  });

  it("leaves the first load to the initial loader", () => {
    expect(shouldRefreshGraph(snapshot, { ahead: 1 }, 0)).toBe(false);
  });

  it("ignores a cleared snapshot", () => {
    expect(shouldRefreshGraph(snapshot, null, PAGE_SIZE)).toBe(false);
  });
});

describe("refreshLimit", () => {
  it("reloads at least one page", () => {
    expect(refreshLimit(0)).toBe(PAGE_SIZE);
    expect(refreshLimit(5)).toBe(PAGE_SIZE);
  });

  it("keeps every page that is already loaded", () => {
    expect(refreshLimit(PAGE_SIZE * 3)).toBe(PAGE_SIZE * 3);
  });
});
