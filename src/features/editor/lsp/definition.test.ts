import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { EditorState } from "@codemirror/state";

const invokeMock = vi.hoisted(() => vi.fn());
const lspDefinitionMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("./client", () => ({ lspDefinition: lspDefinitionMock }));
vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

import {
  jumpToDefinition,
  definitionLinkField,
  positionToLsp,
  setDefinitionLink,
} from "./definition";
import {
  getLspDocumentSentContent,
  markLspDocumentSynced,
  unmarkLspDocument,
} from "./lspDocuments";
import { useEditorStore } from "@/shared/stores/editor";

const FILE = "C:/project/src/a.ts";
const OTHER = "C:/project/src/other.ts";

describe("positionToLsp", () => {
  const doc = EditorState.create({ doc: "line one\nline two\nline three" }).doc;

  it("converts document start to 0/0", () => {
    expect(positionToLsp(doc, 0)).toEqual({ line: 0, character: 0 });
  });

  it("converts offsets to zero-based line and character", () => {
    expect(positionToLsp(doc, 12)).toEqual({ line: 1, character: 3 });
  });

  it("handles the end of the document", () => {
    expect(positionToLsp(doc, 28)).toEqual({ line: 2, character: 10 });
  });
});

describe("definitionLinkField", () => {
  it("decorates the hovered range while a definition is available", () => {
    let state = EditorState.create({
      doc: "const language = 1;",
      extensions: [definitionLinkField],
    });
    state = state.update({ effects: setDefinitionLink.of({ from: 6, to: 14 }) }).state;
    expect(state.field(definitionLinkField).size).toBe(1);
  });

  it("clears the decoration when the link is cleared", () => {
    let state = EditorState.create({
      doc: "const language = 1;",
      extensions: [definitionLinkField],
    });
    state = state.update({ effects: setDefinitionLink.of({ from: 6, to: 14 }) }).state;
    state = state.update({ effects: setDefinitionLink.of(null) }).state;
    expect(state.field(definitionLinkField).size).toBe(0);
  });
});

describe("jumpToDefinition", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    lspDefinitionMock.mockReset();
    toastErrorMock.mockReset();
    unmarkLspDocument(FILE);
    unmarkLspDocument(OTHER);
    invokeMock.mockResolvedValue(null);
    useEditorStore.setState({
      tabs: [
        {
          id: FILE,
          kind: "file",
          path: FILE,
          name: "a.ts",
          content: "old content",
          originalContent: "old content",
          isModified: false,
          language: "typescript",
        },
      ],
      tabStates: [{ tabId: FILE, cursor: { line: 1, column: 1 }, scrollTop: 0 }],
      activeTabId: FILE,
      activeTabIds: {},
    });
  });

  it("flushes pending document changes before requesting the definition", async () => {
    markLspDocumentSynced(FILE, "old content");
    const order: string[] = [];
    invokeMock.mockImplementation(async (cmd: string) => {
      order.push(`invoke:${cmd}`);
      return null;
    });
    lspDefinitionMock.mockImplementation(async () => {
      order.push("lspDefinition");
      return null;
    });

    await jumpToDefinition("typescript", FILE, 0, 5, "new content");

    expect(order).toEqual(["invoke:lsp_did_change", "lspDefinition"]);
    expect(getLspDocumentSentContent(FILE)).toBe("new content");
  });

  it("jumps to a definition inside an already open tab", async () => {
    lspDefinitionMock.mockResolvedValue({ filePath: FILE, line: 4, character: 9 });

    await jumpToDefinition("typescript", FILE, 0, 5);

    const state = useEditorStore.getState();
    expect(state.activeTabId).toBe(FILE);
    expect(state.tabStates.find((s) => s.tabId === FILE)?.pendingScroll).toEqual({
      line: 5,
      column: 10,
    });
  });

  it("opens the target file in a new tab when it is not open", async () => {
    lspDefinitionMock.mockResolvedValue({ filePath: OTHER, line: 2, character: 3 });
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "read_text_file") {
        return { path: OTHER, name: "other.ts", content: "export const x = 1;" };
      }
      return null;
    });

    await jumpToDefinition("typescript", FILE, 0, 5);

    const state = useEditorStore.getState();
    expect(state.tabs.some((t) => t.id === OTHER)).toBe(true);
    expect(state.activeTabId).toBe(OTHER);
    expect(state.tabStates.find((s) => s.tabId === OTHER)?.pendingScroll).toEqual({
      line: 3,
      column: 4,
    });
  });

  it("does nothing when the server reports no definition", async () => {
    lspDefinitionMock.mockResolvedValue(null);

    await jumpToDefinition("typescript", FILE, 0, 5);

    const state = useEditorStore.getState();
    expect(state.tabStates.every((s) => !s.pendingScroll)).toBe(true);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("reports request failures instead of failing silently", async () => {
    lspDefinitionMock.mockRejectedValue(new Error("server exploded"));

    await jumpToDefinition("typescript", FILE, 0, 5);

    expect(toastErrorMock).toHaveBeenCalledWith("server exploded");
  });
});
