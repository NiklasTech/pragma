import { indentLess, indentMore } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import type { StateCommand } from "@codemirror/state";
import type { KeyBinding } from "@codemirror/view";

// Tab inserts the indent unit at the cursor; with a selection it indents lines.
// (CodeMirror's indentWithTab always indents at the line start.)
export const insertTabOrIndentUnit: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly) {
    return false;
  }
  if (state.selection.ranges.some((range) => !range.empty)) {
    return indentMore({ state, dispatch });
  }
  dispatch(
    state.update(state.replaceSelection(state.facet(indentUnit)), {
      scrollIntoView: true,
      userEvent: "input",
    }),
  );
  return true;
};

export const insertTabBinding: KeyBinding = {
  key: "Tab",
  run: insertTabOrIndentUnit,
  shift: indentLess,
};
