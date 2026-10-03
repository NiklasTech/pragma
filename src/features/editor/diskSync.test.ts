import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { useDiskStateStore } from "@/shared/stores/diskState";
import { keepLocalVersion, syncTabsWithDisk } from "./diskSync";

function openTab(path: string, originalContent: string, content = originalContent): void {
  useEditorStore.getState().openFile({
    id: path,
    path,
    name: path.split("/").pop() ?? path,
    content,
    originalContent,
    isModified: content !== originalContent,
  });
}

function tab(path: string): FileTab | undefined {
  return useEditorStore
    .getState()
    .tabs.find((t): t is FileTab => t.kind === "file" && t.path === path);
}

function diskReturns(files: Record<string, string>): void {
  invokeMock.mockImplementation(async (_cmd: string, args: { path: string }) => {
    const content = files[args.path];
    if (content === undefined) throw `File not found: ${args.path}`;
    return { path: args.path, name: "", content };
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  useEditorStore.setState({ tabs: [], tabStates: [], activeTabId: null, activeTabIds: {} });
  useDiskStateStore.setState({ statuses: {} });
});

describe("syncTabsWithDisk", () => {
  it("reloads a tab without unsaved edits", async () => {
    openTab("/w/a.ts", "old");
    diskReturns({ "/w/a.ts": "new from agent" });

    await syncTabsWithDisk(["/w/a.ts"]);

    expect(tab("/w/a.ts")).toMatchObject({
      content: "new from agent",
      originalContent: "new from agent",
      isModified: false,
    });
    expect(useDiskStateStore.getState().statuses).toEqual({});
  });

  it("flags a tab with unsaved edits instead of overwriting them", async () => {
    openTab("/w/a.ts", "old", "my edit");
    diskReturns({ "/w/a.ts": "new from agent" });

    await syncTabsWithDisk(["/w/a.ts"]);

    expect(tab("/w/a.ts")?.content).toBe("my edit");
    expect(useDiskStateStore.getState().statuses["/w/a.ts"]).toBe("changed");
  });

  it("ignores events that leave the file as loaded", async () => {
    openTab("/w/a.ts", "same", "my edit");
    diskReturns({ "/w/a.ts": "same" });

    await syncTabsWithDisk(["/w/a.ts"]);

    expect(tab("/w/a.ts")?.content).toBe("my edit");
    expect(useDiskStateStore.getState().statuses).toEqual({});
  });

  it("marks tabs inside a deleted folder as deleted", async () => {
    openTab("/w/src/a.ts", "content");
    diskReturns({});

    await syncTabsWithDisk(["/w/src"]);

    expect(tab("/w/src/a.ts")?.content).toBe("content");
    expect(useDiskStateStore.getState().statuses["/w/src/a.ts"]).toBe("deleted");
  });
});

describe("keepLocalVersion", () => {
  it("keeps the edits and takes the disk version as the new base", async () => {
    openTab("/w/a.ts", "old", "my edit");
    useDiskStateStore.getState().setStatus("/w/a.ts", "changed");
    diskReturns({ "/w/a.ts": "new from agent" });

    await keepLocalVersion("/w/a.ts");

    expect(tab("/w/a.ts")).toMatchObject({
      content: "my edit",
      originalContent: "new from agent",
      isModified: true,
    });
    expect(useDiskStateStore.getState().statuses).toEqual({});
  });
});
