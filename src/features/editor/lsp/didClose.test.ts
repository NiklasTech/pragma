import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { isLspDocumentSynced, markLspDocumentSynced } from "./lspDocuments";
import { findClosedFilePaths, startLspDidCloseWatcher } from "./didClose";

const TEST_PATH = "C:/project/src/a.ts";

function openTestFile() {
  useEditorStore.getState().openFile({
    id: TEST_PATH,
    path: TEST_PATH,
    name: "a.ts",
    content: "",
    originalContent: "",
    isModified: false,
    language: "typescript",
  });
}

describe("findClosedFilePaths", () => {
  it("returns paths present before but not after", () => {
    expect(findClosedFilePaths(["/a.ts", "/b.ts"], ["/a.ts"])).toEqual(["/b.ts"]);
  });

  it("returns empty when nothing was closed", () => {
    expect(findClosedFilePaths(["/a.ts"], ["/a.ts", "/b.ts"])).toEqual([]);
  });
});

describe("startLspDidCloseWatcher", () => {
  beforeEach(() => {
    useEditorStore.setState({ tabs: [], tabStates: [], activeTabId: null, activeTabIds: {} });
    useSettingsStore.setState((state) => ({
      experimental: { ...state.experimental, lsp: true },
    }));
  });

  it("invokes lsp_did_close for a synced file tab that is closed", () => {
    const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
    const stop = startLspDidCloseWatcher((cmd, args) => {
      calls.push({ cmd, args });
      return Promise.resolve();
    });

    openTestFile();
    markLspDocumentSynced(TEST_PATH);
    useEditorStore.getState().closeTab(TEST_PATH);

    expect(calls).toEqual([
      { cmd: "lsp_did_close", args: { language: "typescript", filePath: TEST_PATH } },
    ]);
    expect(isLspDocumentSynced(TEST_PATH)).toBe(false);
    stop();
  });

  it("ignores closed tabs that were never synced", () => {
    const calls: unknown[] = [];
    const stop = startLspDidCloseWatcher(() => {
      calls.push(1);
      return Promise.resolve();
    });

    openTestFile();
    useEditorStore.getState().closeTab(TEST_PATH);

    expect(calls).toEqual([]);
    stop();
  });
});
