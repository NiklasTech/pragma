import { beforeEach, describe, expect, it } from "vite-plus/test";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  openRepositoriesPersistOptions,
  openRepositoriesStoreCreator,
  type OpenRepositoriesStore,
} from "./openRepositories";
import { firstTabId, type SpacesSnapshot } from "./spaces/model";

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
      ...openRepositoriesPersistOptions,
      storage: createJSONStorage<SpacesSnapshot>(() => storage),
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

describe("spaces", () => {
  it("opens a space with one tab for each repository", () => {
    const store = createStore();
    store.getState().add("/work/pragma");

    const [space] = store.getState().spaces;
    expect(space).toMatchObject({ name: "pragma", folders: ["/work/pragma"] });
    expect(space.tabs.map((tab) => tab.kind)).toEqual(["agents", "code"]);
    expect(space.activeTabId).toBe(firstTabId("/work/pragma"));
    expect(store.getState().activeSpaceId).toBe(space.id);
  });

  it("adds, activates, renames and closes tabs but keeps the last one", () => {
    const store = createStore();
    store.getState().add("/a");
    const spaceId = store.getState().spaces[0].id;

    const review = store.getState().addTab(spaceId, "Review");
    expect(review).not.toBeNull();
    expect(store.getState().spaces[0].activeTabId).toBe(review);

    store.getState().activateTab(spaceId, firstTabId("/a"));
    expect(store.getState().spaces[0].activeTabId).toBe(firstTabId("/a"));

    store.getState().renameTab(spaceId, review ?? "", "  Planning  ");
    expect(store.getState().spaces[0].tabs.map((tab) => tab.name)).toEqual([
      "Agents",
      "Code",
      "Planning",
    ]);

    store.getState().closeTab(spaceId, review ?? "");
    store.getState().closeTab(spaceId, firstTabId("/a"));
    expect(store.getState().spaces[0].tabs.map((tab) => tab.kind)).toEqual(["code"]);

    store.getState().closeTab(spaceId, store.getState().spaces[0].tabs[0].id);
    expect(store.getState().spaces[0].tabs).toHaveLength(1);
  });

  it("shows the first tab of a kind in the active space", () => {
    const store = createStore();
    store.getState().add("/a");
    store.getState().activateTabKind("code");
    const [space] = store.getState().spaces;
    expect(space.tabs.find((tab) => tab.id === space.activeTabId)?.kind).toBe("code");
  });

  it("returns null when adding a tab to an unknown space", () => {
    expect(createStore().getState().addTab("missing", "Tab")).toBeNull();
  });

  it("restores spaces, tabs and the active tab after a restart", async () => {
    const storage = memoryStorage();
    const first = createStore(storage);
    first.getState().add("/a");
    first.getState().add("/b");
    const spaceId = first.getState().spaces[0].id;
    const tabId = first.getState().addTab(spaceId, "Agents");
    first.getState().activate("/a");

    const second = createStore(storage);
    await second.persist.rehydrate();

    expect(second.getState().spaces).toEqual(first.getState().spaces);
    expect(second.getState().activeSpaceId).toBe(spaceId);
    expect(second.getState().spaces[0].activeTabId).toBe(tabId);
    expect(second.getState().paths).toEqual(["/a", "/b"]);
    expect(second.getState().activePath).toBe("/a");
  });

  it("migrates the open repositories of earlier versions into spaces", async () => {
    const storage = memoryStorage();
    storage.setItem(
      "test.open-repositories",
      JSON.stringify({ state: { paths: ["/a", "/b"], activePath: "/b" }, version: 0 }),
    );

    const store = createStore(storage);
    await store.persist.rehydrate();

    expect(store.getState().paths).toEqual(["/a", "/b"]);
    expect(store.getState().activePath).toBe("/b");
    expect(store.getState().spaces.map((space) => space.tabs[0].id)).toEqual([
      firstTabId("/a"),
      firstTabId("/b"),
    ]);
  });

  it("keeps an empty list when nothing was stored", async () => {
    const store = createStore();
    await store.persist.rehydrate();
    expect(store.getState()).toMatchObject({ spaces: [], activeSpaceId: null, paths: [] });
  });
});
