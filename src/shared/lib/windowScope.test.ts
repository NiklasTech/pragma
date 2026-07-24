import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
}));

import { getCurrentWindow } from "@tauri-apps/api/window";
import { getWindowScope, isWorkspaceWindow } from "./windowScope";

const mockedGetCurrentWindow = vi.mocked(getCurrentWindow);

function mockLabel(label: string) {
  mockedGetCurrentWindow.mockReturnValue({ label } as unknown as ReturnType<
    typeof getCurrentWindow
  >);
}

describe("getWindowScope", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it("returns the window label for the main window", () => {
    mockLabel("main");
    expect(getWindowScope()).toBe("main");
  });

  it("returns the window label for workspace windows", () => {
    mockLabel("workspace-2");
    expect(getWindowScope()).toBe("workspace-2");
  });

  it("returns the parent query param for floating windows", () => {
    mockLabel("floating-editor-1");
    vi.stubGlobal("location", { search: "?nodeId=x&parent=workspace-2" });
    expect(getWindowScope()).toBe("workspace-2");
  });

  it("falls back to main for floating windows without parent param", () => {
    mockLabel("floating-editor-1");
    vi.stubGlobal("location", { search: "?nodeId=x" });
    expect(getWindowScope()).toBe("main");
  });

  it("falls back to main outside Tauri", () => {
    mockedGetCurrentWindow.mockImplementation(() => {
      throw new Error("not in tauri");
    });
    expect(getWindowScope()).toBe("main");
  });
});

describe("isWorkspaceWindow", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("is true for main and workspace windows", () => {
    mockLabel("main");
    expect(isWorkspaceWindow()).toBe(true);
    mockLabel("workspace-3");
    expect(isWorkspaceWindow()).toBe(true);
  });

  it("is false for floating windows", () => {
    mockLabel("floating-editor-1");
    expect(isWorkspaceWindow()).toBe(false);
  });

  it("is false outside Tauri", () => {
    mockedGetCurrentWindow.mockImplementation(() => {
      throw new Error("not in tauri");
    });
    expect(isWorkspaceWindow()).toBe(false);
  });
});
