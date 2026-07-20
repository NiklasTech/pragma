import { describe, expect, it } from "vite-plus/test";
import { EditorState } from "@codemirror/state";

import { applyEditsToContent, lspTextEditsToChangeSpec, type LspTextEdit } from "./edits";

const replaceFirstWord: LspTextEdit = {
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
  newText: "hi",
};

describe("lspTextEditsToChangeSpec", () => {
  it("converts an LSP edit to a CodeMirror change", () => {
    const doc = EditorState.create({ doc: "hello\nworld" }).doc;
    const changes = lspTextEditsToChangeSpec(doc, [replaceFirstWord]);
    expect(changes).toEqual([{ from: 0, to: 5, insert: "hi" }]);
  });

  it("sorts multiple edits by descending offset so they can be applied in one dispatch", () => {
    const doc = EditorState.create({ doc: "hello\nworld" }).doc;
    const edits: LspTextEdit[] = [
      replaceFirstWord,
      {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
        newText: "there",
      },
    ];
    const changes = lspTextEditsToChangeSpec(doc, edits);
    expect(changes).toEqual([
      { from: 6, to: 11, insert: "there" },
      { from: 0, to: 5, insert: "hi" },
    ]);
  });
});

describe("applyEditsToContent", () => {
  it("applies a single replacement", () => {
    expect(applyEditsToContent("hello\nworld", [replaceFirstWord])).toBe("hi\nworld");
  });

  it("applies multiple non-overlapping edits", () => {
    const edits: LspTextEdit[] = [
      replaceFirstWord,
      {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
        newText: "there",
      },
    ];
    expect(applyEditsToContent("hello\nworld", edits)).toBe("hi\nthere");
  });

  it("applies an insertion without deleting", () => {
    const edits: LspTextEdit[] = [
      {
        range: { start: { line: 0, character: 5 }, end: { line: 0, character: 5 } },
        newText: "!",
      },
    ];
    expect(applyEditsToContent("hello", edits)).toBe("hello!");
  });

  it("applies a deletion", () => {
    const edits: LspTextEdit[] = [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
        newText: "",
      },
    ];
    expect(applyEditsToContent("hello\nworld", edits)).toBe("world");
  });

  it("handles CRLF line endings without shifting offsets", () => {
    const edits: LspTextEdit[] = [
      {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
        newText: "X",
      },
    ];
    expect(applyEditsToContent("a\r\nb", edits)).toBe("a\r\nX");
  });
});
