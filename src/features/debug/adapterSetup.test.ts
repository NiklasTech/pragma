import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { dapInstallAdapterMock, toastMock } = vi.hoisted(() => ({
  dapInstallAdapterMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: toastMock }));
vi.mock("./client", () => ({ dapInstallAdapter: dapInstallAdapterMock }));

import { installAdapter, installResultSucceeded } from "./adapterSetup";
import { debugTargetForLanguage } from "./debugCurrentFile";
import type { DapAdapterInfo } from "./client";

describe("debugTargetForLanguage", () => {
  it("maps python to the python adapter", () => {
    expect(debugTargetForLanguage("python")).toEqual({ adapter: "python", runtime: "python" });
  });

  it("maps javascript and typescript to the node adapter", () => {
    expect(debugTargetForLanguage("javascript")).toEqual({ adapter: "node", runtime: "node" });
    expect(debugTargetForLanguage("typescript")).toEqual({ adapter: "node", runtime: "node" });
  });

  it("maps rust to the lldb adapter without a runtime", () => {
    expect(debugTargetForLanguage("rust")).toEqual({ adapter: "lldb", runtime: "" });
  });

  it("returns null for unsupported languages", () => {
    expect(debugTargetForLanguage("go")).toBeNull();
    expect(debugTargetForLanguage(undefined)).toBeNull();
  });
});

describe("installResultSucceeded", () => {
  it("is true only for exit code 0", () => {
    expect(installResultSucceeded({ stdout: "", stderr: "", exitCode: 0 })).toBe(true);
    expect(installResultSucceeded({ stdout: "", stderr: "", exitCode: 1 })).toBe(false);
    expect(installResultSucceeded({ stdout: "", stderr: "", exitCode: -1 })).toBe(false);
  });
});

describe("installAdapter", () => {
  const adapter: DapAdapterInfo = {
    id: "python",
    label: "Python (debugpy)",
    available: false,
    install_hint: "pip install debugpy",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toasts success on exit code 0", async () => {
    dapInstallAdapterMock.mockResolvedValue({ stdout: "ok", stderr: "", exitCode: 0 });
    await expect(installAdapter(adapter)).resolves.toBe(true);
    expect(toastMock.success).toHaveBeenCalledOnce();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("toasts stderr on failure", async () => {
    dapInstallAdapterMock.mockResolvedValue({ stdout: "", stderr: "boom", exitCode: 1 });
    await expect(installAdapter(adapter)).resolves.toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });

  it("toasts the error when the command rejects", async () => {
    dapInstallAdapterMock.mockRejectedValue(new Error("no python"));
    await expect(installAdapter(adapter)).resolves.toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("no python"));
  });
});
