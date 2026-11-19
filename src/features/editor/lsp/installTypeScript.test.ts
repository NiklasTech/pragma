import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { useLspRetryStore } from "@/shared/stores/lspRetry";

import { installTypeScript } from "./installTypeScript";

describe("installTypeScript", () => {
  beforeEach(() => {
    mocks.invoke.mockReset();
    Object.values(mocks.toast).forEach((fn) => fn.mockReset());
  });

  it("installs through the TypeScript server entry and starts open files again", async () => {
    mocks.invoke.mockResolvedValue("added 2 packages");
    const before = useLspRetryStore.getState().attempt;

    await installTypeScript();

    expect(mocks.invoke).toHaveBeenCalledWith("lsp_install_server", { language: "typescript" });
    expect(mocks.toast.success).toHaveBeenCalled();
    expect(useLspRetryStore.getState().attempt).toBe(before + 1);
  });

  it("reports a failed install and leaves the files alone", async () => {
    mocks.invoke.mockRejectedValue("npm not found");
    const before = useLspRetryStore.getState().attempt;

    await installTypeScript();

    expect(mocks.toast.error).toHaveBeenCalledWith(
      "TypeScript could not be installed: npm not found",
      expect.anything(),
    );
    expect(useLspRetryStore.getState().attempt).toBe(before);
  });
});
