import { Chunk } from "@codemirror/merge";
import {
  Facet,
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  Text,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  ViewPlugin,
  WidgetType,
  gutter,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import type { GitLineSelection } from "@/shared/stores/git";

export interface GitChangeActions {
  stage: (selection: GitLineSelection) => void;
}

export type ChangeKind = "added" | "modified" | "deleted";

interface GitChangeState {
  base: Text | null;
  chunks: readonly Chunk[];
  markers: RangeSet<GutterMarker>;
  peek: number | null;
}

/** Sets the index content the document is compared against; null hides the gutter. */
export const setGitBaseline = StateEffect.define<string | null>();
const setPeek = StateEffect.define<number | null>();

const gitChangeActions = Facet.define<GitChangeActions, GitChangeActions | null>({
  combine: (values) => values[0] ?? null,
});

class ChangeMarker extends GutterMarker {
  constructor(readonly kind: ChangeKind) {
    super();
  }

  override eq(other: GutterMarker): boolean {
    return other instanceof ChangeMarker && other.kind === this.kind;
  }

  override toDOM(): HTMLElement {
    const element = document.createElement("div");
    element.className = `cm-git-change cm-git-change-${this.kind}`;
    return element;
  }
}

const MARKERS: Record<ChangeKind, ChangeMarker> = {
  added: new ChangeMarker("added"),
  modified: new ChangeMarker("modified"),
  deleted: new ChangeMarker("deleted"),
};

function chunkKind(chunk: Chunk): ChangeKind {
  if (chunk.fromA === chunk.toA) return "added";
  if (chunk.fromB === chunk.toB) return "deleted";
  return "modified";
}

function buildMarkers(doc: Text, chunks: readonly Chunk[]): RangeSet<GutterMarker> {
  const builder = new RangeSetBuilder<GutterMarker>();
  let lastLine = 0;
  for (const chunk of chunks) {
    const kind = chunkKind(chunk);
    const from = Math.min(chunk.fromB, doc.length);
    const to = kind === "deleted" ? from : Math.min(chunk.endB, doc.length);
    for (let pos = from; pos <= to;) {
      const line = doc.lineAt(pos);
      if (line.number > lastLine) {
        builder.add(line.from, line.from, MARKERS[kind]);
        lastLine = line.number;
      }
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

function toBaseline(content: string | null): Text | null {
  return content === null ? null : Text.of(content.split(/\r\n?|\n/));
}

const gitChangeField = StateField.define<GitChangeState>({
  create: () => ({ base: null, chunks: [], markers: RangeSet.empty, peek: null }),
  update(value, tr) {
    let { base, chunks, peek } = value;
    let rebuild = false;
    for (const effect of tr.effects) {
      if (effect.is(setGitBaseline)) {
        base = toBaseline(effect.value);
        rebuild = true;
      }
      if (effect.is(setPeek)) peek = effect.value;
    }
    if (rebuild) {
      chunks = base ? Chunk.build(base, tr.state.doc) : [];
    } else if (tr.docChanged && base) {
      chunks = Chunk.updateB(chunks, base, tr.state.doc, tr.changes);
    } else {
      return peek === value.peek ? value : { ...value, peek };
    }
    if (tr.docChanged) peek = null;
    return { base, chunks, markers: buildMarkers(tr.state.doc, chunks), peek };
  },
});

function findChunk(state: EditorState, lineFrom: number): Chunk | undefined {
  const { chunks } = state.field(gitChangeField);
  const line = state.doc.lineAt(lineFrom);
  return chunks.find((chunk) => {
    const from = Math.min(chunk.fromB, state.doc.length);
    if (chunkKind(chunk) === "deleted") return state.doc.lineAt(from).number === line.number;
    return from <= line.to && Math.min(chunk.endB, state.doc.length) >= line.from;
  });
}

function revertChunk(view: EditorView, chunk: Chunk): void {
  const { base } = view.state.field(gitChangeField);
  if (!base) return;
  let insert = base.sliceString(chunk.fromA, Math.max(chunk.fromA, chunk.toA - 1));
  if (chunk.fromA !== chunk.toA && chunk.toB <= view.state.doc.length) {
    insert += view.state.lineBreak;
  }
  view.dispatch({
    changes: { from: chunk.fromB, to: Math.min(view.state.doc.length, chunk.toB), insert },
    userEvent: "revert",
  });
}

function lineRange(doc: Text, from: number, end: number): number[] {
  const first = doc.lineAt(Math.min(from, doc.length)).number;
  const last = doc.lineAt(Math.min(end, doc.length)).number;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

function chunkSelection(state: EditorState, chunk: Chunk): GitLineSelection {
  const { base } = state.field(gitChangeField);
  const kind = chunkKind(chunk);
  return {
    old_lines: base && kind !== "added" ? lineRange(base, chunk.fromA, chunk.endA) : [],
    new_lines: kind !== "deleted" ? lineRange(state.doc, chunk.fromB, chunk.endB) : [],
  };
}

class PeekWidget extends WidgetType {
  constructor(
    readonly chunk: Chunk,
    readonly original: string,
  ) {
    super();
  }

  override eq(other: PeekWidget): boolean {
    return other.chunk.fromB === this.chunk.fromB && other.original === this.original;
  }

  override toDOM(view: EditorView): HTMLElement {
    const root = document.createElement("div");
    root.className = "cm-git-peek";

    const actions = document.createElement("div");
    actions.className = "cm-git-peek-actions";
    const addAction = (label: string, run: () => void) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cm-git-peek-button";
      button.textContent = label;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        run();
      });
      actions.appendChild(button);
    };
    const handlers = view.state.facet(gitChangeActions);
    if (handlers) {
      addAction("Stage hunk", () => {
        handlers.stage(chunkSelection(view.state, this.chunk));
        view.dispatch({ effects: setPeek.of(null) });
      });
    }
    addAction("Revert hunk", () => revertChunk(view, this.chunk));
    addAction("Close", () => view.dispatch({ effects: setPeek.of(null) }));
    root.appendChild(actions);

    if (this.original.length > 0) {
      const original = document.createElement("pre");
      original.className = "cm-git-peek-original";
      original.textContent = this.original;
      root.appendChild(original);
    }
    return root;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

const peekDecorations = EditorView.decorations.compute([gitChangeField], (state): DecorationSet => {
  const { base, chunks, peek } = state.field(gitChangeField);
  if (peek === null || !base) return Decoration.none;
  const chunk = chunks.find((c) => c.fromB === peek);
  if (!chunk) return Decoration.none;
  const original = base.sliceString(chunk.fromA, Math.max(chunk.fromA, chunk.toA - 1));
  const at = state.doc.lineAt(Math.min(chunk.fromB, state.doc.length)).from;
  return Decoration.set([
    Decoration.widget({ widget: new PeekWidget(chunk, original), block: true, side: -1 }).range(at),
  ]);
});

function moveToChange(view: EditorView, direction: 1 | -1): boolean {
  const { chunks } = view.state.field(gitChangeField, false) ?? { chunks: [] };
  if (chunks.length === 0) return false;
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const before = chunks.filter((c) => Math.min(c.endB, view.state.doc.length) < line.from);
  const target =
    direction === 1
      ? (chunks.find((c) => c.fromB > line.to) ?? chunks[0])
      : (before[before.length - 1] ?? chunks[chunks.length - 1]);
  if (!target) return false;
  const pos = Math.min(target.fromB, view.state.doc.length);
  view.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: "center" }),
  });
  return true;
}

let focusedView: EditorView | null = null;

const trackFocus = ViewPlugin.define((view) => ({
  update(update) {
    if (update.focusChanged && view.hasFocus) focusedView = view;
  },
  destroy() {
    if (focusedView === view) focusedView = null;
  },
}));

/** The editor that last had focus among those showing git changes. */
export function focusedGitChangeView(): EditorView | null {
  return focusedView;
}

export interface GitChangeRange {
  from: number;
  to: number;
  kind: ChangeKind;
}

/** Ranges changed against the git index; empty while the gutter is off. */
export function gitChangeRanges(state: EditorState): GitChangeRange[] {
  const field = state.field(gitChangeField, false);
  if (!field) return [];
  return field.chunks.map((chunk) => ({
    from: Math.min(chunk.fromB, state.doc.length),
    to: Math.min(chunk.endB, state.doc.length),
    kind: chunkKind(chunk),
  }));
}

export const goToNextChange = (view: EditorView): boolean => moveToChange(view, 1);
export const goToPreviousChange = (view: EditorView): boolean => moveToChange(view, -1);

const gitChangeTheme = EditorView.theme({
  ".cm-git-change-gutter": { width: "3px", marginRight: "2px" },
  ".cm-git-change-gutter .cm-gutterElement": { cursor: "pointer" },
  ".cm-git-change": { width: "3px", height: "100%" },
  ".cm-git-change-added": { background: "var(--color-status-success)" },
  ".cm-git-change-modified": { background: "var(--color-status-info)" },
  ".cm-git-change-deleted": {
    height: "0",
    borderLeft: "3px solid var(--color-status-error)",
    borderTop: "3px solid transparent",
    borderBottom: "3px solid transparent",
    transform: "translateY(-3px)",
  },
  ".cm-git-peek": {
    borderTop: "1px solid var(--border-default)",
    borderBottom: "1px solid var(--border-default)",
    background: "var(--bg-elevated)",
    fontFamily: "inherit",
  },
  ".cm-git-peek-actions": { display: "flex", gap: "4px", padding: "2px 8px" },
  ".cm-git-peek-button": {
    border: "none",
    borderRadius: "3px",
    background: "transparent",
    color: "var(--fg-muted)",
    fontSize: "11px",
    padding: "1px 6px",
    cursor: "pointer",
  },
  ".cm-git-peek-button:hover": { background: "var(--bg-hover)", color: "var(--fg-default)" },
  ".cm-git-peek-original": {
    margin: "0",
    padding: "0 8px",
    background: "var(--color-status-error-bg)",
    color: "var(--fg-muted)",
    textDecoration: "line-through",
    whiteSpace: "pre",
    overflowX: "auto",
  },
});

/** Gutter markers for lines changed against the git index, with an inline peek to stage or revert. */
export function gitChangeGutter(actions: GitChangeActions): Extension {
  return [
    gitChangeField,
    gitChangeActions.of(actions),
    gutter({
      class: "cm-git-change-gutter",
      markers: (view) => view.state.field(gitChangeField).markers,
      domEventHandlers: {
        mousedown(view, line) {
          const chunk = findChunk(view.state, line.from);
          if (!chunk) return false;
          const { peek } = view.state.field(gitChangeField);
          view.dispatch({ effects: setPeek.of(peek === chunk.fromB ? null : chunk.fromB) });
          return true;
        },
      },
    }),
    peekDecorations,
    trackFocus,
    keymap.of([
      { key: "Alt-F5", run: goToNextChange },
      { key: "Shift-Alt-F5", run: goToPreviousChange },
    ]),
    gitChangeTheme,
  ];
}
