import { describe, expect, it } from "vite-plus/test";
import { EditorState } from "@codemirror/state";

import { positionToLsp } from "./definition";

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
