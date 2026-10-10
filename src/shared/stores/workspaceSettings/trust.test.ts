import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { isFolderTrusted, useFolderTrustStore } = await import("./trust");

describe("folder trust", () => {
  beforeEach(() => {
    invoke.mockReset();
    useFolderTrustStore.setState({ rootPath: null, trusted: false });
  });

  it("asks in the workspace window and trusts only the decided folder", async () => {
    invoke.mockResolvedValue(true);
    await useFolderTrustStore.getState().load("/work/app", true);

    expect(invoke).toHaveBeenCalledWith("workspace_trust_request", { rootPath: "/work/app" });
    expect(isFolderTrusted("/work/app")).toBe(true);
    expect(isFolderTrusted("/work/other")).toBe(false);
  });

  it("only reads the decision in other windows", async () => {
    invoke.mockResolvedValue({ trusted: null, content: { extensions: [], scripts: [] } });
    await useFolderTrustStore.getState().load("/work/app", false);

    expect(invoke).toHaveBeenCalledWith("workspace_trust_status", { rootPath: "/work/app" });
    expect(isFolderTrusted("/work/app")).toBe(false);
  });

  it("stays untrusted when the request fails", async () => {
    invoke.mockRejectedValue(new Error("dialog failed"));
    await useFolderTrustStore.getState().load("/work/app", true);
    expect(isFolderTrusted("/work/app")).toBe(false);
  });
});
