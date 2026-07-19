import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";

const invokeMock = vi.hoisted(() => vi.fn());
const lspCompletionMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("./client", () => ({
  lspCompletion: lspCompletionMock,
  lspCompletionResolve: vi.fn(),
}));

import { createLspCompletionSource, documentationToText, mapCompletionItem } from "./completion";
import { markLspDocumentSynced, unmarkLspDocument } from "./lspDocuments";

describe("mapCompletionItem", () => {
  it("maps LSP kinds to CodeMirror completion types", () => {
    expect(mapCompletionItem({ label: "foo", kind: 3 }).type).toBe("function");
    expect(mapCompletionItem({ label: "Foo", kind: 7 }).type).toBe("class");
    expect(mapCompletionItem({ label: "bar", kind: 6 }).type).toBe("variable");
    expect(mapCompletionItem({ label: "x" }).type).toBe("text");
  });

  it("falls back to label for sortText and apply", () => {
    const completion = mapCompletionItem({ label: "console" });
    expect(completion.sortText).toBe("console");
    expect(completion.apply).toBe("console");
  });

  it("prefers insertText over label for apply", () => {
    expect(mapCompletionItem({ label: "log", insertText: "console.log" }).apply).toBe(
      "console.log",
    );
  });

  it("keeps detail for the label suffix", () => {
    expect(mapCompletionItem({ label: "map", detail: "(method)" }).detail).toBe("(method)");
  });
});

describe("documentationToText", () => {
  it("passes plain strings through", () => {
    expect(documentationToText("docs")).toBe("docs");
  });

  it("extracts value from MarkupContent", () => {
    expect(documentationToText({ kind: "markdown", value: "**docs**" })).toBe("**docs**");
  });

  it("returns null for missing or empty documentation", () => {
    expect(documentationToText(undefined)).toBeNull();
    expect(documentationToText(null)).toBeNull();
    expect(documentationToText("")).toBeNull();
  });
});

describe("createLspCompletionSource", () => {
  const FILE = "C:/project/src/a.ts";
  const flags = {
    completion: true,
    completionResolve: false,
    completionTriggerCharacters: ["."],
    definition: true,
  };

  beforeEach(() => {
    invokeMock.mockReset();
    lspCompletionMock.mockReset();
    unmarkLspDocument(FILE);
    invokeMock.mockResolvedValue(null);
    lspCompletionMock.mockResolvedValue([]);
  });

  it("flushes pending document changes before requesting completions", async () => {
    markLspDocumentSynced(FILE, "old");
    const order: string[] = [];
    invokeMock.mockImplementation(async (cmd: string) => {
      order.push(`invoke:${cmd}`);
      return null;
    });
    lspCompletionMock.mockImplementation(async () => {
      order.push("lspCompletion");
      return [];
    });

    const state = EditorState.create({ doc: "console." });
    const context = new CompletionContext(state, 8, true);
    await createLspCompletionSource("typescript", FILE, flags)(context);

    expect(order).toEqual(["invoke:lsp_did_change", "lspCompletion"]);
  });

  it("skips the flush when the document is already in sync", async () => {
    markLspDocumentSynced(FILE, "console.");

    const state = EditorState.create({ doc: "console." });
    const context = new CompletionContext(state, 8, true);
    await createLspCompletionSource("typescript", FILE, flags)(context);

    expect(invokeMock).not.toHaveBeenCalled();
    expect(lspCompletionMock).toHaveBeenCalledWith("typescript", FILE, 0, 8);
  });
});
