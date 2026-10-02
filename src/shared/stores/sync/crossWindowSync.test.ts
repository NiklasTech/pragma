import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { create } from "zustand";

const { listenMock, emitMock, getCurrentWindowMock } = vi.hoisted(() => ({
  listenMock: vi.fn(),
  emitMock: vi.fn(),
  getCurrentWindowMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock, emit: emitMock }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: getCurrentWindowMock }));

import { crossWindowSync, setScopedPeerProbe, whenCrossWindowSyncReady } from "./crossWindowSync";

describe("whenCrossWindowSyncReady", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it("resolves only after the store listeners finished registering", async () => {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    const resolvers: Array<(unlisten: () => void) => void> = [];
    listenMock.mockImplementation(
      () => new Promise<() => void>((resolve) => resolvers.push(resolve)),
    );

    create<{ value: number }>()(
      crossWindowSync<{ value: number }>("readyTest", "main")(() => ({ value: 1 })),
    );
    expect(listenMock).toHaveBeenCalledTimes(2);

    let resolved = false;
    const ready = whenCrossWindowSyncReady().then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    for (const resolve of resolvers) resolve(() => {});
    await ready;
    expect(resolved).toBe(true);
  });

  it("resolves immediately outside Tauri", async () => {
    await whenCrossWindowSyncReady();
  });
});

describe("scoped store broadcasts", () => {
  afterEach(() => {
    setScopedPeerProbe(() => true);
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  function createWorkspaceStore(scope: string | undefined) {
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
    listenMock.mockResolvedValue(() => {});
    getCurrentWindowMock.mockReturnValue({ label: "main" });
    const store = create<{ value: number }>()(
      crossWindowSync<{ value: number }>("peerTest", scope)(() => ({ value: 0 })),
    );
    // The first local change only marks the workspace window as ready.
    store.setState({ value: 1 });
    return store;
  }

  it("skips scoped diffs while no floating window listens", () => {
    setScopedPeerProbe(() => false);
    const store = createWorkspaceStore("main");
    store.setState({ value: 2 });
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("emits scoped diffs once a floating window exists", () => {
    let hasPeers = false;
    setScopedPeerProbe(() => hasPeers);
    const store = createWorkspaceStore("main");
    hasPeers = true;
    store.setState({ value: 2 });
    expect(emitMock).toHaveBeenCalledWith("pragma:store:peerTest:main", {
      source: "main",
      partial: { value: 2 },
    });
  });

  it("always emits unscoped stores to other workspace windows", () => {
    setScopedPeerProbe(() => false);
    const store = createWorkspaceStore(undefined);
    store.setState({ value: 2 });
    expect(emitMock).toHaveBeenCalledTimes(1);
  });
});
