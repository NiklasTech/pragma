import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { dapEnsureAdapterMock, listenMock, toastMock } = vi.hoisted(() => ({
  dapEnsureAdapterMock: vi.fn(),
  listenMock: vi.fn(),
  toastMock: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("./client", () => ({
  dapEnsureAdapter: dapEnsureAdapterMock,
  listenDapInstallProgress: listenMock,
}));

import { ensureAdapterForLanguage } from "./ensureAdapter";
import type { DapInstallProgressEvent } from "./client";

describe("ensureAdapterForLanguage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listenMock.mockResolvedValue(vi.fn());
  });

  it("returns the adapter id without toasts when already available", async () => {
    dapEnsureAdapterMock.mockResolvedValue({
      adapterId: "python",
      installed: false,
      available: true,
    });
    await expect(ensureAdapterForLanguage("python")).resolves.toBe("python");
    expect(toastMock.loading).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.dismiss).toHaveBeenCalled();
  });

  it("toasts success when an install happened", async () => {
    dapEnsureAdapterMock.mockResolvedValue({
      adapterId: "lldb",
      installed: true,
      available: true,
    });
    await expect(ensureAdapterForLanguage("rust")).resolves.toBe("lldb");
    expect(toastMock.success).toHaveBeenCalledWith(
      expect.stringContaining("lldb"),
      expect.objectContaining({ id: "dap-install-rust" }),
    );
  });

  it("toasts an error when the adapter stays unavailable", async () => {
    dapEnsureAdapterMock.mockResolvedValue({
      adapterId: "lldb",
      installed: true,
      available: false,
    });
    await expect(ensureAdapterForLanguage("rust")).resolves.toBeNull();
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining("lldb"),
      expect.objectContaining({ id: "dap-install-rust" }),
    );
  });

  it("toasts the error when ensure rejects", async () => {
    dapEnsureAdapterMock.mockRejectedValue(new Error("Download failed: HTTP 404"));
    await expect(ensureAdapterForLanguage("rust")).resolves.toBeNull();
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringContaining("HTTP 404"),
      expect.objectContaining({ id: "dap-install-rust" }),
    );
  });

  it("forwards download progress to the loading toast", async () => {
    let handler: ((event: DapInstallProgressEvent) => void) | undefined;
    listenMock.mockImplementation((cb: (event: DapInstallProgressEvent) => void) => {
      handler = cb;
      return Promise.resolve(vi.fn());
    });
    dapEnsureAdapterMock.mockResolvedValue({
      adapterId: "lldb",
      installed: true,
      available: true,
    });

    await ensureAdapterForLanguage("rust");
    handler?.({ adapterId: "lldb", stage: "downloading", percent: 42, message: "Downloading" });
    expect(toastMock.loading).toHaveBeenCalledWith(
      "Downloading 42%",
      expect.objectContaining({ id: "dap-install-rust" }),
    );
  });
});
