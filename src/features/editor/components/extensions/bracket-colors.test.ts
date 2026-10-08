import { describe, expect, it } from "vite-plus/test";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { forEachBracket } from "./bracket-colors";

function bracketDepths(doc: string): string[] {
  const state = EditorState.create({ doc, extensions: [javascript()] });
  ensureSyntaxTree(state, doc.length, 5000);
  const result: string[] = [];
  forEachBracket(state, 0, doc.length, (pos, depth) => result.push(`${doc[pos]}${depth}`));
  return result;
}

describe("forEachBracket", () => {
  it("reports nesting depth for matching pairs", () => {
    expect(bracketDepths("f(a, [1, { b: 2 }]);")).toEqual(["(0", "[1", "{2", "}2", "]1", ")0"]);
  });

  it("ignores brackets inside strings and comments", () => {
    expect(bracketDepths('g("(" /* [ */);')).toEqual(["(0", ")0"]);
  });
});
