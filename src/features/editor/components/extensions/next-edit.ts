import { invoke } from "@tauri-apps/api/core";
import { Annotation, type Extension, Prec, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

import { externalUpdate } from "@/features/editor/compartments";

import { diffRegion, locatePrediction, type PredictedEdit } from "./next-edit-diff";

export interface NextEditConfig {
  debounceMs: number;
  filePath: string;
  provider: string;
  model: string;
  baseUrl?: string;
}

interface Prediction {
  from: number;
  to: number;
  replace: string;
}

interface RecentEdit {
  line: number;
  removed: string;
  inserted: string;
}

const MAX_RECENT_EDITS = 5;
const MAX_EDIT_TEXT = 2000;
const MAX_CONTENT = 50_000;
const MIN_DELAY_MS = 800;
const WORD = /\w/;

const setPrediction = StateEffect.define<Prediction | null>();

/// Marks the insert of an accepted prediction, which is not itself a new edit to predict from.
const acceptedPrediction = Annotation.define<boolean>();

const predictionField = StateField.define<Prediction | null>({
  create: () => null,
  update: (value, tr) => {
    for (const effect of tr.effects) if (effect.is(setPrediction)) return effect.value;
    return tr.docChanged ? null : value;
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state) => {
      const prediction = state.field(field);
      if (!prediction) return Decoration.none;
      return Decoration.set([
        Decoration.mark({ class: "cm-next-edit-old" }).range(prediction.from, prediction.to),
        Decoration.widget({ widget: new ReplacementWidget(prediction.replace), side: 1 }).range(
          prediction.to,
        ),
      ]);
    }),
});

class ReplacementWidget extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-next-edit-new";
    span.textContent = this.text;
    const hint = document.createElement("span");
    hint.className = "cm-next-edit-hint";
    hint.textContent = "Tab";
    span.appendChild(hint);
    return span;
  }

  eq(other: ReplacementWidget): boolean {
    return other.text === this.text;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class NextEditPlugin {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private baseline: string;
  private recent: RecentEdit[] = [];

  constructor(
    private readonly view: EditorView,
    private readonly config: NextEditConfig,
  ) {
    this.baseline = view.state.doc.toString();
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return;
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    // Reloads from disk and agent edits are not the user's edits to predict from.
    if (
      update.transactions.some(
        (tr) => tr.annotation(acceptedPrediction) || tr.effects.some((e) => e.is(externalUpdate)),
      )
    ) {
      this.baseline = update.state.doc.toString();
      return;
    }
    this.timer = setTimeout(
      () => this.predict(),
      Math.max(MIN_DELAY_MS, this.config.debounceMs * 2),
    );
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
    this.generation += 1;
  }

  private predict(): void {
    this.timer = null;
    const state = this.view.state;
    const current = state.doc.toString();
    const region = diffRegion(this.baseline, current);
    this.baseline = current;
    if (
      !region ||
      current.length > MAX_CONTENT ||
      region.removed.length > MAX_EDIT_TEXT ||
      region.inserted.length > MAX_EDIT_TEXT ||
      !WORD.test(region.removed + region.inserted)
    ) {
      return;
    }

    const line = state.doc.lineAt(Math.min(region.offset, state.doc.length)).number;
    this.recent = [...this.recent, { line, ...region }].slice(-MAX_RECENT_EDITS);
    const cursorLine = state.doc.lineAt(state.selection.main.head).number;
    const generation = ++this.generation;

    void invoke<PredictedEdit | null>("ai_next_edit", {
      req: {
        file_path: this.config.filePath,
        content: current,
        cursor_line: cursorLine,
        recent_edits: this.recent.map(({ line, removed, inserted }) => ({
          line,
          removed,
          inserted,
        })),
        provider: this.config.provider,
        model: this.config.model,
        base_url: this.config.baseUrl,
      },
    })
      .then((edit) => {
        if (!edit || generation !== this.generation) return;
        const range = locatePrediction(this.view.state.doc, edit, cursorLine);
        if (range) {
          this.view.dispatch({ effects: setPrediction.of({ ...range, replace: edit.replace }) });
        }
      })
      .catch(() => {});
  }
}

/// First Tab jumps to the prediction, the second applies it.
function acceptOrJump(view: EditorView): boolean {
  const prediction = view.state.field(predictionField);
  if (!prediction) return false;
  const head = view.state.selection.main.head;
  if (head < prediction.from || head > prediction.to) {
    view.dispatch({
      selection: { anchor: prediction.from },
      effects: EditorView.scrollIntoView(prediction.from, { y: "center" }),
    });
    return true;
  }
  view.dispatch({
    changes: { from: prediction.from, to: prediction.to, insert: prediction.replace },
    selection: { anchor: prediction.from + prediction.replace.length },
    annotations: acceptedPrediction.of(true),
  });
  return true;
}

const nextEditTheme = EditorView.baseTheme({
  ".cm-next-edit-old": {
    textDecoration: "line-through",
    backgroundColor: "var(--color-status-error-bg)",
  },
  ".cm-next-edit-new": {
    marginLeft: "0.25em",
    padding: "0 0.25em",
    borderRadius: "3px",
    backgroundColor: "var(--color-status-success-bg)",
    color: "var(--color-status-success)",
    whiteSpace: "pre",
  },
  ".cm-next-edit-hint": {
    marginLeft: "0.5em",
    fontSize: "0.8em",
    opacity: "0.7",
  },
});

/// Suggests the next edit elsewhere in the file after the user pauses typing.
export function nextEditExtension(config: NextEditConfig): Extension[] {
  return [
    predictionField,
    ViewPlugin.define((view) => new NextEditPlugin(view, config)),
    Prec.high(
      keymap.of([
        { key: "Tab", run: acceptOrJump },
        {
          key: "Escape",
          run: (view) => {
            if (!view.state.field(predictionField)) return false;
            view.dispatch({ effects: setPrediction.of(null) });
            return true;
          },
        },
      ]),
    ),
    nextEditTheme,
  ];
}
