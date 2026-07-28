import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CompletionContext, type CompletionInfo } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";

const invokeMock = vi.hoisted(() => vi.fn());
const lspCompletionMock = vi.hoisted(() => vi.fn());
const lspCompletionResolveMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("./client", () => ({
  lspCompletion: lspCompletionMock,
  lspCompletionResolve: lspCompletionResolveMock,
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
    hover: true,
    references: true,
    formatting: true,
    rename: true,
    signatureHelp: true,
    signatureHelpTriggerCharacters: ["(", ","],
    codeAction: true,
    documentSymbol: true,
    workspaceSymbol: true,
    incrementalSync: true,
  };

  beforeEach(() => {
    invokeMock.mockReset();
    lspCompletionMock.mockReset();
    lspCompletionResolveMock.mockReset();
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

  it("does not trigger on an implicit non-trigger character", async () => {
    const state = EditorState.create({ doc: "const x = " });
    const context = new CompletionContext(state, 10, false);
    const result = await createLspCompletionSource("typescript", FILE, flags)(context);

    expect(result).toBeNull();
    expect(lspCompletionMock).not.toHaveBeenCalled();
  });

  it("triggers on a configured trigger character", async () => {
    lspCompletionMock.mockResolvedValue([{ label: "log" }]);

    const state = EditorState.create({ doc: "console." });
    const context = new CompletionContext(state, 8, false);
    const result = await createLspCompletionSource("typescript", FILE, flags)(context);

    expect(lspCompletionMock).toHaveBeenCalledWith("typescript", FILE, 0, 8);
    expect(result?.options.map((option) => option.label)).toEqual(["log"]);
  });

  it("triggers on a partially typed word without a trigger character", async () => {
    lspCompletionMock.mockResolvedValue([{ label: "console" }]);

    const state = EditorState.create({ doc: "con" });
    const context = new CompletionContext(state, 3, false);
    const result = await createLspCompletionSource("typescript", FILE, flags)(context);

    expect(lspCompletionMock).toHaveBeenCalledWith("typescript", FILE, 0, 3);
    expect(result?.from).toBe(0);
  });
});

describe("completion info documentation", () => {
  const FILE = "C:/project/src/a.ts";
  const baseFlags = {
    completion: true,
    completionResolve: false,
    completionTriggerCharacters: ["."],
    definition: true,
    hover: true,
    references: true,
    formatting: true,
    rename: true,
    signatureHelp: true,
    signatureHelpTriggerCharacters: ["(", ","],
    codeAction: true,
    documentSymbol: true,
    workspaceSymbol: true,
    incrementalSync: true,
  };
  const resolveFlags = { ...baseFlags, completionResolve: true };

  interface FakeElement {
    className: string;
    textContent: string;
    children: unknown[];
    classList: { add: ReturnType<typeof vi.fn> };
    appendChild: (child: unknown) => void;
  }

  let createdElements: FakeElement[];

  function stubDocument(): void {
    createdElements = [];
    vi.stubGlobal("document", {
      createElement: vi.fn(() => {
        const element: FakeElement = {
          className: "",
          textContent: "",
          children: [],
          classList: { add: vi.fn() },
          appendChild: (child: unknown) => {
            element.children.push(child);
          },
        };
        createdElements.push(element);
        return element;
      }),
      createTextNode: vi.fn((text: string) => ({ text })),
    });
  }

  async function infoDomFor(
    item: { label: string; documentation?: unknown; detail?: string },
    sourceFlags: typeof baseFlags,
  ): Promise<CompletionInfo> {
    lspCompletionMock.mockResolvedValue([item]);
    const state = EditorState.create({ doc: "map" });
    const context = new CompletionContext(state, 3, true);
    const result = await createLspCompletionSource("typescript", FILE, sourceFlags)(context);
    const info = result?.options[0]?.info;
    if (typeof info !== "function" || !result) {
      throw new Error("expected an info callback on the completion");
    }
    return info(result.options[0]);
  }

  beforeEach(() => {
    invokeMock.mockReset();
    lspCompletionMock.mockReset();
    lspCompletionResolveMock.mockReset();
    unmarkLspDocument(FILE);
    invokeMock.mockResolvedValue(null);
    lspCompletionMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when there is no documentation and resolve is unsupported", async () => {
    const dom = await infoDomFor({ label: "map" }, baseFlags);

    expect(dom).toBeNull();
    expect(lspCompletionResolveMock).not.toHaveBeenCalled();
  });

  it("builds a documentation dom from inline documentation", async () => {
    stubDocument();

    const dom = await infoDomFor({ label: "map", documentation: "inline docs" }, resolveFlags);

    expect(dom).not.toBeNull();
    expect(lspCompletionResolveMock).not.toHaveBeenCalled();
    expect(createdElements[0].className).toBe("cm-lsp-markdown");
    expect(createdElements[0].classList.add).toHaveBeenCalledWith("cm-lsp-completion-doc");
  });

  it("resolves documentation through the server when supported", async () => {
    stubDocument();
    lspCompletionResolveMock.mockResolvedValue({ label: "map", documentation: "**resolved**" });

    const dom = await infoDomFor({ label: "map" }, resolveFlags);

    expect(dom).not.toBeNull();
    expect(lspCompletionResolveMock).toHaveBeenCalledWith("typescript", FILE, { label: "map" });
  });

  it("falls back to the resolved detail when documentation is missing", async () => {
    stubDocument();
    lspCompletionResolveMock.mockResolvedValue({ label: "map", detail: "(method) map" });

    const dom = await infoDomFor({ label: "map" }, resolveFlags);

    expect(dom).not.toBeNull();
  });

  it("returns null when resolution fails", async () => {
    lspCompletionResolveMock.mockRejectedValue(new Error("server exploded"));

    const dom = await infoDomFor({ label: "map" }, resolveFlags);

    expect(dom).toBeNull();
  });
});
