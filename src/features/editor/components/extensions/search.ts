import {
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
} from "@codemirror/search";
import { keymap, type EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

export type EditorSearchMode = "find" | "replace";

const REPLACE_FIELD_SELECTOR = ".cm-panel.cm-search [name=replace]";

function focusPanelField(view: EditorView, selector: string): void {
  const field = view.dom.querySelector<HTMLInputElement>(selector);
  if (!field) return;
  field.focus();
  field.select();
}

// The replace field only exists once the panel DOM has been mounted, so focus it
// after the current microtask.
export function openEditorSearchPanel(view: EditorView, mode: EditorSearchMode): void {
  openSearchPanel(view);
  if (mode === "replace") {
    queueMicrotask(() => focusPanelField(view, REPLACE_FIELD_SELECTOR));
  }
}

export function searchExtension(): Extension {
  return [search(), highlightSelectionMatches(), keymap.of(searchKeymap)];
}
