import { describe, expect, it } from "vite-plus/test";
import { EditorState } from "@codemirror/state";

import { lspToPosition } from "./hover";

describe("lspToPosition", () => {
  const doc = EditorState.create({ doc: "line one\nline two\nline three" }).doc;

  it("converts 0/0 to document start", () => {
    expect(lspToPosition(doc, 0, 0)).toBe(0);
  });

  it("converts zero-based line and character to an offset", () => {
    expect(lspToPosition(doc, 1, 3)).toBe(12);
  });

  it("clamps positions beyond the line end", () => {
    expect(lspToPosition(doc, 2, 100)).toBe(28);
  });

  it("clamps lines beyond the document end to the last line", () => {
    expect(lspToPosition(doc, 99, 0)).toBe(18);
  });
});
