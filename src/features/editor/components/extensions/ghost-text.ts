import { invoke } from "@tauri-apps/api/core";
import { type Extension, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

interface GhostTextConfig {
  enabled: boolean;
  debounceMs: number;
  triggerCharacters: string[];
  filePath: string;
  provider: string;
  model: string;
  baseUrl?: string;
}

interface GhostTextState {
  suggestion: string | null;
  pos: number;
  loading: boolean;
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
}

const WORD_CHAR_REGEX = /\w/;

const setGhostText = StateEffect.define<GhostTextState>();

const initialGhostState: GhostTextState = {
  suggestion: null,
  pos: 0,
  loading: false,
};

const ghostTextField = StateField.define<GhostTextState>({
  create: () => initialGhostState,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setGhostText)) {
        return effect.value;
      }
    }
    return value;
  },
  provide: (field) =>
    EditorView.decorations.compute([field], (state) => {
      const ghost = state.field(field);
      if (!ghost.suggestion || ghost.suggestion.length === 0) {
        return Decoration.none;
      }
      const widget = new GhostTextWidget(ghost.suggestion);
      return Decoration.set([Decoration.widget({ widget, side: 1 }).range(ghost.pos)]);
    }),
});

class GhostTextWidget extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    span.textContent = this.text;
    return span;
  }

  eq(other: GhostTextWidget): boolean {
    return other.text === this.text;
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
      effects: setGhostText.of({ suggestion: null, pos, loading: true }),
    });

    void this.fetch(pos, currentGeneration);
  }

  private async fetch(pos: number, generation: number): Promise<void> {
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

    try {
      const result = await invoke<InlineCompletionResponse>("ai_inline_completion", { req });
      if (generation !== this.generation) {
        return;
      }

      const suggestion = result.suggestion.trim();
      if (suggestion.length > 0) {
        this.view.dispatch({
          effects: setGhostText.of({ suggestion, pos, loading: false }),
        });
      } else {
        this.clearGhost();
      }
    } catch {
      if (generation !== this.generation) {
        return;
      }
      this.clearGhost();
    }
  }
}

const ghostTextKeymap = keymap.of([
  {
    key: "Tab",
    run: (view) => {
      const ghost = view.state.field(ghostTextField);
      if (!ghost.suggestion) {
        return false;
      }

      view.dispatch({
        changes: { from: ghost.pos, to: ghost.pos, insert: ghost.suggestion },
        selection: { anchor: ghost.pos + ghost.suggestion.length },
        effects: setGhostText.of(initialGhostState),
      });
      return true;
    },
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
]);

const ghostTextTheme = EditorView.baseTheme({
  ".cm-ghost-text": {
    color: "var(--editor-ghost-text, #888888)",
    fontStyle: "italic",
    opacity: "0.7",
    pointerEvents: "none",
    userSelect: "none",
    whiteSpace: "pre",
  },
});

export type { GhostTextConfig };

export function ghostTextExtension(config: GhostTextConfig): Extension[] {
  return [
    ghostTextField,
    ViewPlugin.define((view) => new GhostTextPlugin(view, config)),
    ghostTextKeymap,
    ghostTextTheme,
  ];
}
