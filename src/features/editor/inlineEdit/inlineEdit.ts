import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type Extension, Prec, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap, WidgetType } from "@codemirror/view";

import { getIsMac } from "@/shared/lib/shortcuts";

import { InlineEditPanel } from "./InlineEditPanel";
import { useInlineEditStore } from "./inlineEditStore";
import { wholeLineRange } from "./inlineEditText";

export interface InlineEditRange {
  id: number;
  from: number;
  to: number;
  /** The proposed code, shown as added lines under the old ones. */
  replacement: string | null;
}

const openEdit = StateEffect.define<InlineEditRange>();
const proposeEdit = StateEffect.define<string | null>();
export const closeEdit = StateEffect.define<null>();
const markApplied = StateEffect.define<number | null>();

let nextId = 1;
const APPLIED_MS = 4000;

const editField = StateField.define<InlineEditRange | null>({
  create: () => null,
  update: (value, tr) => {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(openEdit)) next = effect.value;
      else if (effect.is(proposeEdit) && next) next = { ...next, replacement: effect.value };
      else if (effect.is(closeEdit)) next = null;
    }
    if (!next || !tr.docChanged || next !== value) return next;
    // Typing inside the lines under review ends the review; edits elsewhere move it along.
    let touched = false;
    tr.changes.iterChangedRanges((fromA, toA) => {
      if (fromA <= next.to && toA >= next.from) touched = true;
    });
    if (touched && next.replacement !== null) return null;
    return { ...next, from: tr.changes.mapPos(next.from, -1), to: tr.changes.mapPos(next.to, 1) };
  },
});

const appliedField = StateField.define<number | null>({
  create: () => null,
  update: (value, tr) => {
    for (const effect of tr.effects) if (effect.is(markApplied)) return effect.value;
    return tr.docChanged ? null : value;
  },
});

const roots = new WeakMap<HTMLElement, Root>();
const fitters = new WeakMap<HTMLElement, ResizeObserver>();
const PANEL_GAP_PX = 12;

/// Keeps the panel inside the visible code area, so it never widens the content or scrolls out of view.
function fitToVisibleWidth(view: EditorView, dom: HTMLElement): ResizeObserver {
  const fit = () => {
    const gutter = view.contentDOM.offsetLeft;
    dom.style.left = `${gutter}px`;
    dom.style.maxWidth = `${Math.max(view.scrollDOM.clientWidth - gutter - PANEL_GAP_PX, 0)}px`;
    view.requestMeasure();
  };
  const observer = new ResizeObserver(fit);
  observer.observe(view.scrollDOM);
  return observer;
}

class PanelWidget extends WidgetType {
  constructor(readonly id: number) {
    super();
  }
  eq(other: PanelWidget): boolean {
    return other.id === this.id;
  }
  toDOM(view: EditorView): HTMLElement {
    const dom = document.createElement("div");
    dom.className = "cm-inline-edit-panel";
    const root = createRoot(dom);
    root.render(createElement(InlineEditPanel, { view, id: this.id }));
    roots.set(dom, root);
    fitters.set(dom, fitToVisibleWidth(view, dom));
    return dom;
  }
  destroy(dom: HTMLElement): void {
    fitters.get(dom)?.disconnect();
    const root = roots.get(dom);
    // React must not unmount while CodeMirror is still updating the DOM.
    if (root) queueMicrotask(() => root.unmount());
  }
  ignoreEvent(): boolean {
    return true;
  }
}

class AddedLinesWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: AddedLinesWidget): boolean {
    return other.text === this.text;
  }
  toDOM(): HTMLElement {
    const dom = document.createElement("div");
    dom.className = "cm-inline-edit-added";
    for (const line of this.text.split("\n")) {
      const row = document.createElement("div");
      row.className = "cm-inline-edit-added-line";
      row.textContent = line || " ";
      dom.appendChild(row);
    }
    return dom;
  }
}

class AppliedWidget extends WidgetType {
  eq(): boolean {
    return true;
  }
  toDOM(): HTMLElement {
    const dom = document.createElement("span");
    dom.className = "cm-inline-edit-applied";
    dom.textContent = `Applied · ${getIsMac() ? "⌘Z" : "Ctrl+Z"} undoes`;
    return dom;
  }
}

const decorations = EditorView.decorations.compute([editField, appliedField], (state) => {
  const builder = new RangeSetBuilder<Decoration>();
  const edit = state.field(editField);
  if (edit) {
    const first = state.doc.lineAt(edit.from);
    builder.add(
      first.from,
      first.from,
      Decoration.widget({ widget: new PanelWidget(edit.id), block: true, side: -1 }),
    );
    if (edit.replacement !== null) {
      const last = state.doc.lineAt(edit.to);
      for (let number = first.number; number <= last.number; number++) {
        const line = state.doc.line(number);
        builder.add(line.from, line.from, Decoration.line({ class: "cm-inline-edit-removed" }));
      }
      if (edit.replacement !== "") {
        builder.add(
          last.to,
          last.to,
          Decoration.widget({
            widget: new AddedLinesWidget(edit.replacement),
            block: true,
            side: 1,
          }),
        );
      }
    }
  }
  const applied = state.field(appliedField);
  if (applied !== null && applied <= state.doc.length) {
    const line = state.doc.lineAt(applied);
    builder.add(line.to, line.to, Decoration.widget({ widget: new AppliedWidget(), side: 1 }));
  }
  return builder.finish();
});

export function currentEdit(view: EditorView): InlineEditRange | null {
  return view.state.field(editField, false) ?? null;
}

/// Opens the instruction field over the selected lines, or over the cursor's line.
export function startInlineEdit(view: EditorView, filePath: string): boolean {
  const previous = currentEdit(view);
  if (previous) useInlineEditStore.getState().end(previous.id);
  const { from, to } = view.state.selection.main;
  const range = wholeLineRange(view.state.doc, from, to);
  const id = nextId++;
  useInlineEditStore.getState().begin(id, filePath);
  view.dispatch({ effects: openEdit.of({ id, ...range, replacement: null }) });
  return true;
}

export function proposeInlineEdit(view: EditorView, replacement: string | null): void {
  view.dispatch({ effects: proposeEdit.of(replacement) });
}

export function closeInlineEdit(view: EditorView): void {
  const edit = currentEdit(view);
  if (edit) useInlineEditStore.getState().end(edit.id);
  view.dispatch({ effects: closeEdit.of(null) });
  view.focus();
}

/// Writes the proposed code in one undoable step and notes it on the first changed line.
export function acceptInlineEdit(view: EditorView): boolean {
  const edit = currentEdit(view);
  if (!edit || edit.replacement === null) return false;
  useInlineEditStore.getState().end(edit.id);
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.replacement },
    effects: [closeEdit.of(null)],
    selection: { anchor: edit.from },
    userEvent: "input.ai",
  });
  view.dispatch({ effects: markApplied.of(edit.from) });
  window.setTimeout(() => {
    if (view.state.field(appliedField, false) === edit.from) {
      view.dispatch({ effects: markApplied.of(null) });
    }
  }, APPLIED_MS);
  view.focus();
  return true;
}

const theme = EditorView.baseTheme({
  ".cm-inline-edit-panel": { padding: "6px 0", position: "sticky", whiteSpace: "normal" },
  ".cm-inline-edit-removed": {
    backgroundColor: "var(--color-git-deleted-bg)",
  },
  ".cm-inline-edit-added": {
    backgroundColor: "var(--color-git-added-bg)",
    whiteSpace: "pre",
  },
  ".cm-inline-edit-added-line": { paddingLeft: "6px" },
  ".cm-inline-edit-applied": {
    marginLeft: "16px",
    fontFamily: "var(--font-ui)",
    fontSize: "11.5px",
    color: "var(--color-git-added)",
  },
});

/// Cmd/Ctrl+K: an instruction for the selected lines, answered as an inline diff to accept or reject.
export function inlineEditExtension(getFilePath: () => string): Extension {
  return [
    editField,
    appliedField,
    decorations,
    theme,
    Prec.high(
      keymap.of([
        { key: "Mod-k", run: (view) => startInlineEdit(view, getFilePath()) },
        { key: "Mod-Enter", run: acceptInlineEdit },
        {
          key: "Escape",
          run: (view) => {
            if (!currentEdit(view)) return false;
            closeInlineEdit(view);
            return true;
          },
        },
      ]),
    ),
  ];
}
