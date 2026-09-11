import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  highlightSelectionMatches,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  searchKeymap,
  setSearchQuery,
} from "@codemirror/search";
import { keymap, runScopeHandlers, type EditorView, type Panel } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

import { PragmaSearchPanel } from "./search-panel";

export type EditorSearchMode = "find" | "replace";

const panels = new WeakMap<EditorView, PragmaSearchPanel>();

export function createPragmaSearchPanel(view: EditorView): Panel {
  const state = view.state;
  const panel = new PragmaSearchPanel(view.dom.ownerDocument, {
    query: getSearchQuery(state),
    readOnly: state.readOnly,
    labels: {
      find: state.phrase("Find"),
      replace: state.phrase("Replace"),
      next: state.phrase("next"),
      previous: state.phrase("previous"),
      matchCase: state.phrase("match case"),
      regexp: state.phrase("regexp"),
      byWord: state.phrase("by word"),
      close: state.phrase("close"),
      replaceNext: state.phrase("replace"),
      replaceAll: state.phrase("replace all"),
      toggleReplace: state.phrase("Toggle replace"),
    },
    onChange: (query) => {
      if (!query.eq(getSearchQuery(view.state))) {
        view.dispatch({ effects: setSearchQuery.of(query) });
      }
    },
    onFindNext: () => findNext(view),
    onFindPrevious: () => findPrevious(view),
    onReplaceNext: () => replaceNext(view),
    onReplaceAll: () => replaceAll(view),
    onClose: () => closeSearchPanel(view),
  });

  panel.dom.addEventListener("keydown", (event) => {
    const keyEvent = event as KeyboardEvent;
    if (runScopeHandlers(view, keyEvent, "search-panel")) {
      keyEvent.preventDefault();
    } else if (keyEvent.key === "Enter" && keyEvent.target === panel.searchField) {
      keyEvent.preventDefault();
      (keyEvent.shiftKey ? findPrevious : findNext)(view);
    } else if (keyEvent.key === "Enter" && keyEvent.target === panel.replaceField) {
      keyEvent.preventDefault();
      replaceNext(view);
    }
  });

  panels.set(view, panel);

  return {
    dom: panel.dom,
    top: true,
    mount: () => panel.focusSearch(),
    update: (update) => {
      for (const transaction of update.transactions) {
        for (const effect of transaction.effects) {
          if (effect.is(setSearchQuery)) {
            panel.setQuery(effect.value);
          }
        }
      }
    },
    destroy: () => {
      if (panels.get(view) === panel) {
        panels.delete(view);
      }
    },
  };
}

export function openEditorSearchPanel(view: EditorView, mode: EditorSearchMode): void {
  openSearchPanel(view);
  const panel = panels.get(view);
  if (!panel) return;
  if (mode === "replace") {
    panel.setReplaceOpen(true);
    panel.focusReplace();
  } else {
    panel.focusSearch();
  }
}

export function searchExtension(): Extension {
  return [
    search({ top: true, createPanel: createPragmaSearchPanel }),
    highlightSelectionMatches(),
    keymap.of(searchKeymap),
  ];
}
