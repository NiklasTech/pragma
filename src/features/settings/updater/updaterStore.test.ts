import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Update } from "@tauri-apps/plugin-updater";

const { checkMock, relaunchMock } = vi.hoisted(() => ({
  checkMock: vi.fn(),
  relaunchMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({ check: checkMock }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: relaunchMock }));

import { useUpdaterStore } from "./updaterStore";

function mockUpdate(overrides?: Record<string, unknown>): Update {
  return {
    version: "0.3.0",
    body: "Some release notes",
    downloadAndInstall: vi.fn(async () => {}),
    ...overrides,
  } as unknown as Update;
}

beforeEach(async () => {
  checkMock.mockReset().mockResolvedValue(null);
  relaunchMock.mockReset();
  await useUpdaterStore.getState().checkForUpdates();
  useUpdaterStore.setState({ state: { status: "idle" } });
});

describe("useUpdaterStore", () => {
  it("reports up-to-date when no update is available", async () => {
    checkMock.mockResolvedValue(null);

    await useUpdaterStore.getState().checkForUpdates();

    expect(useUpdaterStore.getState().state).toEqual({ status: "up-to-date" });
  });

  it("reports available update with version and notes", async () => {
    checkMock.mockResolvedValue(mockUpdate());

    await useUpdaterStore.getState().checkForUpdates();

    expect(useUpdaterStore.getState().state).toEqual({
      status: "available",
      version: "0.3.0",
      notes: "Some release notes",
    });
  });

  it("maps check failures to the error state", async () => {
    checkMock.mockRejectedValue(new Error("network down"));

    await useUpdaterStore.getState().checkForUpdates();

    expect(useUpdaterStore.getState().state).toEqual({
      status: "error",
      message: "network down",
    });
  });

  it("stays silent on check failures when silent option is set", async () => {
    checkMock.mockRejectedValue(new Error("network down"));

    await useUpdaterStore.getState().checkForUpdates({ silent: true });

    expect(useUpdaterStore.getState().state).toEqual({ status: "idle" });
  });

  it("tracks download progress and ends ready to restart", async () => {
    const downloadMock = vi.fn(async (onEvent?: (event: unknown) => void) => {
      onEvent?.({ event: "Started", data: { contentLength: 200 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 100 } });
      onEvent?.({ event: "Finished" });
    });
    checkMock.mockResolvedValue(mockUpdate({ downloadAndInstall: downloadMock }));
    await useUpdaterStore.getState().checkForUpdates();

    await useUpdaterStore.getState().downloadAndInstall();

    expect(downloadMock).toHaveBeenCalledOnce();
    expect(useUpdaterStore.getState().state).toEqual({
      status: "ready-to-restart",
      version: "0.3.0",
    });
  });

  it("ends ready to restart when the download emits no progress events", async () => {
    const downloadMock = vi.fn(async (onEvent?: (event: unknown) => void) => {
      onEvent?.({ event: "Started", data: { contentLength: 200 } });
      onEvent?.({ event: "Finished" });
    });
    checkMock.mockResolvedValue(mockUpdate({ downloadAndInstall: downloadMock }));
    await useUpdaterStore.getState().checkForUpdates();

    await useUpdaterStore.getState().downloadAndInstall();

    expect(downloadMock).toHaveBeenCalledOnce();
    expect(useUpdaterStore.getState().state).toEqual({
      status: "ready-to-restart",
      version: "0.3.0",
    });
  });

  it("does nothing when downloading without a pending update", async () => {
    await useUpdaterStore.getState().downloadAndInstall();

    expect(useUpdaterStore.getState().state).toEqual({ status: "idle" });
  });

  it("maps download failures to the error state", async () => {
    checkMock.mockResolvedValue(
      mockUpdate({
        downloadAndInstall: vi.fn(async () => {
          throw new Error("signature mismatch");
        }),
      }),
    );
    await useUpdaterStore.getState().checkForUpdates();

    await useUpdaterStore.getState().downloadAndInstall();

    expect(useUpdaterStore.getState().state).toEqual({
      status: "error",
      message: "signature mismatch",
    });
  });

  it("relaunches the app", async () => {
    await useUpdaterStore.getState().restartApp();

    expect(relaunchMock).toHaveBeenCalledOnce();
  });

  it("maps relaunch failures to the error state", async () => {
    relaunchMock.mockRejectedValue(new Error("relaunch failed"));

    await useUpdaterStore.getState().restartApp();

    expect(useUpdaterStore.getState().state).toEqual({
      status: "error",
      message: "relaunch failed",
    });
  });
});
