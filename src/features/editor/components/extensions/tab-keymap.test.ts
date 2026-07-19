import { describe, expect, it } from "vite-plus/test";
import { EditorState, type Transaction } from "@codemirror/state";
import { indentUnit } from "@codemirror/language";

import { insertTabOrIndentUnit } from "./tab-keymap";

function runCommand(
  doc: string,
  anchor: number,
  head?: number,
  extensions = indentUnit.of("\t"),
): { handled: boolean; state: EditorState } {
  const state = EditorState.create({
    doc,
    selection: head === undefined ? { anchor } : { anchor, head },
    extensions,
  });
  let next: EditorState | null = null;
  const handled = insertTabOrIndentUnit({
    state,
    dispatch: (tr: Transaction) => {
      next = tr.state;
    },
  });
  return { handled, state: next ?? state };
}

describe("insertTabOrIndentUnit", () => {
  it("inserts a tab at the cursor position", () => {
    const { handled, state } = runCommand("ab", 1);
    expect(handled).toBe(true);
    expect(state.doc.toString()).toBe("a\tb");
    expect(state.selection.main.head).toBe(2);
  });

  it("inserts the configured indent unit instead of a raw tab", () => {
    const { handled, state } = runCommand("ab", 1, undefined, indentUnit.of("    "));
    expect(handled).toBe(true);
    expect(state.doc.toString()).toBe("a    b");
  });

  it("indents at the line start when there is a selection", () => {
    const { handled, state } = runCommand("hello", 0, 5);
    expect(handled).toBe(true);
    expect(state.doc.toString()).toBe("\thello");
  });

  it("does nothing in a read-only editor", () => {
    const state = EditorState.create({
      doc: "ab",
      selection: { anchor: 1 },
      extensions: [indentUnit.of("\t"), EditorState.readOnly.of(true)],
    });
    const handled = insertTabOrIndentUnit({ state, dispatch: () => {} });
    expect(handled).toBe(false);
    expect(state.doc.toString()).toBe("ab");
  });
});
