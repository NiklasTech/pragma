import { beforeEach, describe, expect, it } from "vite-plus/test";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { openRepositoriesStoreCreator, type OpenRepositoriesStore } from "./openRepositories";

function memoryStorage(): StateStorage {
  const values = new Map<string, string>();
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => void values.set(name, value),
    removeItem: (name) => void values.delete(name),
  };
}

function createStore(storage: StateStorage = memoryStorage()) {
  return create<OpenRepositoriesStore>()(
    persist(openRepositoriesStoreCreator, {
      name: "test.open-repositories",
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({ paths: state.paths, activePath: state.activePath }),
    }),
  );
}

describe("open repositories store", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  it("adds repositories in order and activates the newest", () => {
    store.getState().add("/a");
    store.getState().add("/b");
    store.getState().add("/c");

    expect(store.getState().paths).toEqual(["/a", "/b", "/c"]);
    expect(store.getState().activePath).toBe("/c");
  });

  it("dedupes equal paths and activates the existing entry", () => {
    store.getState().add("/a");
    store.getState().add("/b");

    const stored = store.getState().add("/a/./");

    expect(stored).toBe("/a");
    expect(store.getState().paths).toEqual(["/a", "/b"]);
    expect(store.getState().activePath).toBe("/a");
  });

  it("dedupes Windows paths with mixed separators", () => {
    store.getState().add("C:\\work\\repo");

    store.getState().add("C:/work/repo/");

    expect(store.getState().paths).toEqual(["C:\\work\\repo"]);
  });

  it("activates only repositories that are open", () => {
    store.getState().add("/a");
    store.getState().add("/b");

    store.getState().activate("/a/");
    expect(store.getState().activePath).toBe("/a");

    store.getState().activate("/unknown");
    expect(store.getState().activePath).toBe("/a");
  });

  it("removing the active repository activates the next one", () => {
    store.getState().add("/a");
    store.getState().add("/b");
    store.getState().add("/c");
    store.getState().activate("/b");

    expect(store.getState().remove("/b")).toBe("/c");
    expect(store.getState().paths).toEqual(["/a", "/c"]);
  });

  it("removing the last entry while active falls back to the previous one", () => {
    store.getState().add("/a");
    store.getState().add("/b");

    expect(store.getState().remove("/b")).toBe("/a");
  });

  it("removing an inactive repository keeps the active one", () => {
    store.getState().add("/a");
    store.getState().add("/b");

    expect(store.getState().remove("/a")).toBe("/b");
    expect(store.getState().paths).toEqual(["/b"]);
  });

  it("removing the only repository leaves none active", () => {
    store.getState().add("/a");

    expect(store.getState().remove("/a")).toBeNull();
    expect(store.getState().paths).toEqual([]);
  });

  it("persists the list and the active repository", async () => {
    const storage = memoryStorage();
    const first = createStore(storage);
    first.getState().add("/a");
    first.getState().add("/b");
    first.getState().activate("/a");

    const second = createStore(storage);
    await second.persist.rehydrate();

    expect(second.getState().paths).toEqual(["/a", "/b"]);
    expect(second.getState().activePath).toBe("/a");
  });
});
