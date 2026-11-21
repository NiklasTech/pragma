import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ toast: { error: vi.fn() } }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { recordLspStatus, useLspFailuresStore } from "@/shared/stores/lspFailures";

import { showLspRequestError } from "./requestError";

const NOT_RUNNING = new Error(
  "LSP server for typescript in /tmp/big-repo/pkg02/mod9 is not running",
);

describe("showLspRequestError", () => {
  beforeEach(() => {
    mocks.toast.error.mockReset();
    useLspFailuresStore.setState({ byLanguage: {} });
  });

  it("keeps other errors as they are", () => {
    showLspRequestError("typescript", new Error("Request timed out"));
    expect(mocks.toast.error).toHaveBeenCalledWith("Request timed out");
  });

  it("explains a server that is not running without the folder path", () => {
    showLspRequestError("typescript", NOT_RUNNING);
    const [message, options] = mocks.toast.error.mock.calls[0];
    expect(message).toBe(
      "TypeScript code navigation is not ready for this folder: its language server is not running.",
    );
    expect(options.action.label).toBe("Try again");
  });

  it("offers the TypeScript install when that is why the server failed", () => {
    recordLspStatus("typescript", "error", "Could not find a valid TypeScript installation");
    showLspRequestError("typescript", NOT_RUNNING);
    const [message, options] = mocks.toast.error.mock.calls[0];
    expect(message).toContain("TypeScript features need TypeScript");
    expect(options.action.label).toBe("Install TypeScript");
  });

  it("forgets the failure once the server runs", () => {
    recordLspStatus("rust", "error", "rust-analyzer not found");
    recordLspStatus("rust", "running", undefined);
    expect(useLspFailuresStore.getState().byLanguage).toEqual({});
  });
});
