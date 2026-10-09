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

import {
  addAlternative,
  MAX_ALTERNATIVES,
  nextLineChunk,
  nextWordChunk,
} from "./ghost-text-accept";
import { nextEditExtension } from "./next-edit";

interface GhostTextConfig {
  enabled: boolean;
  debounceMs: number;
  triggerCharacters: string[];
  filePath: string;
  provider: string;
  model: string;
  baseUrl?: string;
  /** Also predict the next edit elsewhere in the file. */
  nextEdit: boolean;
}

interface GhostTextState {
  suggestion: string | null;
  pos: number;
  loading: boolean;
  /** Every suggestion fetched for this position; `suggestion` is the one shown. */
  alternatives: string[];
  index: number;
}

interface InlineCompletionResponse {
  suggestion: string;
}

interface InlineCompletionRequest {
  file_path: string;
  content: string;
  cursor_line: number;
  cursor_column: number;
  provider: string;
  model: string;
  base_url?: string;
  exclude?: string[];
}

const WORD_CHAR_REGEX = /\w/;

const setGhostText = StateEffect.define<GhostTextState>();

/// Marks the insert of a partly accepted suggestion, which keeps the rest on screen.
const partialAccept = Annotation.define<boolean>();

const initialGhostState: GhostTextState = {
  suggestion: null,
  pos: 0,
  loading: false,
  alternatives: [],
  index: 0,
};

function shownState(pos: number, alternatives: string[], index: number): GhostTextState {
  return { suggestion: alternatives[index] ?? null, pos, loading: false, alternatives, index };
}

const ghostTextField = StateField.define<GhostTextState>({
  create: () => initialGhostState,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setGhostText)) {
        return effect.value;
      }
    }
    return tr.docChanged ? { ...value, pos: tr.changes.mapPos(value.pos) } : value;
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state) => {
      const ghost = state.field(field);
      if (!ghost.suggestion || ghost.suggestion.length === 0) {
        return Decoration.none;
      }
      const count =
        ghost.alternatives.length > 1 ? `${ghost.index + 1}/${ghost.alternatives.length}` : null;
      const widget = new GhostTextWidget(ghost.suggestion, count);
      return Decoration.set([Decoration.widget({ widget, side: 1 }).range(ghost.pos)]);
    }),
});

class GhostTextWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly count: string | null,
  ) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.textContent = this.text;
    if (this.count) {
      const badge = document.createElement("span");
      badge.className = "cm-ghost-text-count";
      badge.textContent = this.count;
      span.appendChild(badge);
    }
    return span;
  }

  eq(other: GhostTextWidget): boolean {
    return other.text === this.text && other.count === this.count;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class GhostTextPlugin {
  private clearTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private fetchTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;

  constructor(
    private readonly view: EditorView,
    private readonly config: GhostTextConfig,
  ) {}

  update(update: ViewUpdate): void {
    if (!this.config.enabled) {
      this.clear();
      return;
    }

    if (update.transactions.some((tr) => tr.annotation(partialAccept))) {
      this.generation += 1;
      return;
    }
    if (update.docChanged || update.selectionSet) {
      this.schedule();
    }
  }

  destroy(): void {
    this.clear();
  }

  private clear(): void {
    if (this.clearTimeoutId) {
      clearTimeout(this.clearTimeoutId);
      this.clearTimeoutId = null;
    }
    if (this.fetchTimeoutId) {
      clearTimeout(this.fetchTimeoutId);
      this.fetchTimeoutId = null;
    }
    this.clearGhost();
  }

  private clearGhost(): void {
    const current = this.view.state.field(ghostTextField);
    if (current.suggestion !== null || current.loading) {
      this.view.dispatch({
        effects: setGhostText.of(initialGhostState),
      });
    }
  }

  private schedule(): void {
    if (this.clearTimeoutId) {
      clearTimeout(this.clearTimeoutId);
    }
    if (this.fetchTimeoutId) {
      clearTimeout(this.fetchTimeoutId);
    }

    this.clearTimeoutId = setTimeout(() => this.clearGhost(), 0);
    this.fetchTimeoutId = setTimeout(() => this.maybeFetch(), this.config.debounceMs);
  }

  private maybeFetch(): void {
    this.fetchTimeoutId = null;

    const state = this.view.state;
    const pos = state.selection.main.head;
    const charBefore = pos > 0 ? state.doc.sliceString(pos - 1, pos) : "";

    if (this.config.triggerCharacters.length > 0) {
      if (!this.config.triggerCharacters.includes(charBefore)) {
        return;
      }
    } else if (WORD_CHAR_REGEX.test(charBefore)) {
      // Default: do not trigger in the middle of a word.
      return;
    }

    this.generation += 1;
    const currentGeneration = this.generation;

    this.view.dispatch({
      effects: setGhostText.of({ ...initialGhostState, pos, loading: true }),
    });

    void this.fetch(pos, currentGeneration, []);
  }

  /// Fetches one more suggestion for the shown position, unlike the ones seen so far.
  requestAlternative(): void {
    const ghost = this.view.state.field(ghostTextField);
    if (!ghost.suggestion || ghost.loading) return;
    this.generation += 1;
    const generation = this.generation;
    this.view.dispatch({ effects: setGhostText.of({ ...ghost, loading: true }) });
    void this.fetch(ghost.pos, generation, ghost.alternatives.slice(-MAX_ALTERNATIVES));
  }

  private async fetch(pos: number, generation: number, exclude: string[]): Promise<void> {
    const state = this.view.state;
    const content = state.doc.toString();
    const line = state.doc.lineAt(pos);

    const req: InlineCompletionRequest = {
      file_path: this.config.filePath,
      content,
      cursor_line: line.number,
      cursor_column: pos - line.from + 1,
      provider: this.config.provider,
      model: this.config.model,
      base_url: this.config.baseUrl,
    };
    if (exclude.length > 0) req.exclude = exclude;

    try {
      const result = await invoke<InlineCompletionResponse>("ai_inline_completion", { req });
      if (!this.isPending(pos, generation)) {
        return;
      }

      const suggestion = result.suggestion.trim();
      if (suggestion.length > 0) {
        const next = addAlternative(exclude, suggestion);
        this.view.dispatch({
          effects: setGhostText.of(shownState(pos, next.suggestions, next.index)),
        });
      } else if (exclude.length > 0) {
        this.showStored();
      } else {
        this.clearGhost();
      }
    } catch {
      if (!this.isPending(pos, generation)) {
        return;
      }
      if (exclude.length > 0) this.showStored();
      else this.clearGhost();
    }
  }

  /// False once typing or Escape cleared the request, so a late reply is not shown.
  private isPending(pos: number, generation: number): boolean {
    const ghost = this.view.state.field(ghostTextField);
    return generation === this.generation && ghost.loading && ghost.pos === pos;
  }

  /// An alternative request found nothing new; keep showing what was there.
  private showStored(): void {
    const ghost = this.view.state.field(ghostTextField);
    this.view.dispatch({
      effects: setGhostText.of(shownState(ghost.pos, ghost.alternatives, ghost.index)),
    });
  }
}

const ghostTextPlugin = (config: GhostTextConfig) =>
  ViewPlugin.define((view) => new GhostTextPlugin(view, config));

type GhostPluginSpec = ReturnType<typeof ghostTextPlugin>;

function acceptPart(view: EditorView, pick: (text: string) => string): boolean {
  const ghost = view.state.field(ghostTextField);
  if (!ghost.suggestion) return false;

  const part = pick(ghost.suggestion);
  const rest = ghost.suggestion.slice(part.length);
  const pos = ghost.pos + part.length;
  view.dispatch({
    changes: { from: ghost.pos, to: ghost.pos, insert: part },
    selection: { anchor: pos },
    effects: setGhostText.of(rest ? shownState(pos, [rest], 0) : initialGhostState),
    annotations: rest ? partialAccept.of(true) : [],
  });
  return true;
}

function cycle(view: EditorView, delta: 1 | -1, plugin: GhostPluginSpec): boolean {
  const ghost = view.state.field(ghostTextField);
  if (!ghost.suggestion || ghost.loading) return false;

  const index = ghost.index + delta;
  if (index >= 0 && index < ghost.alternatives.length) {
    view.dispatch({ effects: setGhostText.of(shownState(ghost.pos, ghost.alternatives, index)) });
  } else if (delta > 0) {
    view.plugin(plugin)?.requestAlternative();
  }
  return true;
}

function ghostTextKeymap(plugin: GhostPluginSpec): Extension {
  return Prec.high(
    keymap.of([
      {
        key: "Tab",
        run: (view) => acceptPart(view, (text) => text),
      },
      {
        key: "Mod-ArrowRight",
        run: (view) => acceptPart(view, nextWordChunk),
      },
      {
        key: "Mod-Shift-ArrowRight",
        run: (view) => acceptPart(view, nextLineChunk),
      },
      {
        key: "Alt-]",
        run: (view) => cycle(view, 1, plugin),
      },
      {
        key: "Alt-[",
        run: (view) => cycle(view, -1, plugin),
      },
      {
        key: "Escape",
        run: (view) => {
          const ghost = view.state.field(ghostTextField);
          if (!ghost.suggestion && !ghost.loading) {
            return false;
          }

          view.dispatch({
            effects: setGhostText.of(initialGhostState),
          });
          return true;
        },
      },
    ]),
  );
}

const ghostTextTheme = EditorView.baseTheme({
  ".cm-ghost-text": {
    color: "var(--editor-ghost-text, #888888)",
    fontStyle: "italic",
    opacity: "0.7",
    pointerEvents: "none",
    userSelect: "none",
    whiteSpace: "pre",
  },
  ".cm-ghost-text-count": {
    marginLeft: "0.75em",
    fontStyle: "normal",
    fontSize: "0.85em",
  },
});

export type { GhostTextConfig };

export function ghostTextExtension(config: GhostTextConfig): Extension[] {
  const plugin = ghostTextPlugin(config);
  const extensions = [ghostTextField, plugin, ghostTextKeymap(plugin), ghostTextTheme];
  // Registered after the ghost keymap so a shown suggestion keeps Tab.
  return config.enabled && config.nextEdit
    ? [...extensions, ...nextEditExtension(config)]
    : extensions;
}
