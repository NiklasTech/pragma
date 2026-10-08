import type { Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  drawSelection,
  layer,
  type DecorationSet,
  type LayerMarker,
  type ViewUpdate,
} from "@codemirror/view";
import type { EditorCursorStyle, RenderWhitespace } from "@/shared/stores/settings";

const spaceDeco = Decoration.mark({ class: "cm-ws-space" });
const tabDeco = Decoration.mark({ class: "cm-ws-tab" });

function whitespaceMatcher(regexp: RegExp): MatchDecorator {
  return new MatchDecorator({
    regexp,
    decorate(add, from, _to, match) {
      const text = match[0];
      let runStart = -1;
      for (let i = 0; i <= text.length; i++) {
        const char = text[i];
        if (char === " ") {
          if (runStart < 0) runStart = i;
          continue;
        }
        if (runStart >= 0) {
          add(from + runStart, from + i, spaceDeco);
          runStart = -1;
        }
        if (char === "\t") add(from + i, from + i + 1, tabDeco);
      }
    },
  });
}

// Boundary skips single spaces between words, like other editors do.
const boundaryMatcher = whitespaceMatcher(/^[ \t]+|[ \t]+$|[ \t]{2,}|\t/g);
const allMatcher = whitespaceMatcher(/[ \t]+/g);

function whitespacePlugin(matcher: MatchDecorator): Extension {
  return ViewPlugin.define(
    (view) => ({
      decorations: matcher.createDeco(view),
      update(update: ViewUpdate) {
        this.decorations = matcher.updateDeco(update, this.decorations);
      },
    }),
    { decorations: (plugin): DecorationSet => plugin.decorations },
  );
}

const whitespaceTheme = EditorView.theme({
  ".cm-ws-space": {
    backgroundImage:
      "radial-gradient(circle at 50% 55%, var(--fg-subtle) 0.09em, transparent 0.11em)",
    backgroundSize: "1ch 100%",
    backgroundRepeat: "repeat-x",
  },
  ".cm-ws-tab": {
    backgroundImage: "linear-gradient(var(--fg-subtle), var(--fg-subtle))",
    backgroundSize: "calc(100% - 4px) 1px",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
});

export function renderWhitespaceExtension(mode: RenderWhitespace): Extension {
  if (mode === "none") return [];
  return [whitespacePlugin(mode === "all" ? allMatcher : boundaryMatcher), whitespaceTheme];
}

class RulerMarker implements LayerMarker {
  constructor(
    readonly left: number,
    readonly height: number,
  ) {}

  eq(other: LayerMarker): boolean {
    return other instanceof RulerMarker && other.left === this.left && other.height === this.height;
  }

  draw(): HTMLElement {
    const element = document.createElement("div");
    element.className = "cm-ruler";
    this.adjust(element);
    return element;
  }

  update(element: HTMLElement, oldMarker: LayerMarker): boolean {
    if (!(oldMarker instanceof RulerMarker)) return false;
    this.adjust(element);
    return true;
  }

  private adjust(element: HTMLElement): void {
    element.style.left = `${this.left}px`;
    element.style.height = `${this.height}px`;
  }
}

function rulerMarkers(view: EditorView, columns: readonly number[]): LayerMarker[] {
  const lineStart = view.state.doc.lineAt(view.viewport.from).from;
  const start = view.coordsAtPos(lineStart, 1);
  if (!start) return [];
  const scroller = view.scrollDOM.getBoundingClientRect();
  const origin = start.left - scroller.left + view.scrollDOM.scrollLeft;
  const height = Math.max(view.contentHeight, view.scrollDOM.clientHeight);
  return columns.map(
    (column) => new RulerMarker(origin + column * view.defaultCharacterWidth, height),
  );
}

const rulersTheme = EditorView.theme({
  ".cm-rulers": { pointerEvents: "none" },
  ".cm-ruler": {
    position: "absolute",
    top: "0",
    width: "1px",
    background: "var(--border-subtle)",
  },
});

export function rulersExtension(columns: readonly number[]): Extension {
  if (columns.length === 0) return [];
  return [
    layer({
      above: false,
      class: "cm-rulers",
      markers: (view) => rulerMarkers(view, columns),
      update: (update) => update.geometryChanged || update.viewportChanged,
    }),
    rulersTheme,
  ];
}

export function cursorExtension(style: EditorCursorStyle, blinking: boolean): Extension {
  const extensions: Extension[] = [];
  if (!blinking) extensions.push(drawSelection({ cursorBlinkRate: 0 }));
  if (style === "block") {
    extensions.push(
      EditorView.theme({
        "& .cm-cursorLayer .cm-cursor": {
          borderLeft: "none",
          width: "1ch",
          background: "color-mix(in srgb, var(--editor-cursor) 55%, transparent)",
        },
      }),
    );
  } else if (style === "underline") {
    extensions.push(
      EditorView.theme({
        "& .cm-cursorLayer .cm-cursor": {
          borderLeft: "none",
          width: "1ch",
          borderBottom: "2px solid var(--editor-cursor)",
        },
      }),
    );
  }
  return extensions;
}

export function lineHeightExtension(lineHeight: number): Extension {
  return EditorView.theme({ "&.cm-editor .cm-scroller": { lineHeight: String(lineHeight) } });
}

const noLigatures = EditorView.theme({
  ".cm-content": {
    fontVariantLigatures: "none",
    fontFeatureSettings: '"liga" 0, "calt" 0',
  },
});

export function ligaturesExtension(enabled: boolean): Extension {
  return enabled ? [] : noLigatures;
}
