import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { create } from "zustand";

const { listenMock, emitMock } = vi.hoisted(() => ({
  listenMock: vi.fn(),
  emitMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock, emit: emitMock }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

import { crossWindowSync, whenCrossWindowSyncReady } from "./crossWindowSync";

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
