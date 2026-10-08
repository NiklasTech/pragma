import { RangeSetBuilder, countColumn, type EditorState, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { getIndentUnit, indentUnit } from "@codemirror/language";

const BLANK_LINE_SEARCH = 200;

/** Visual indentation width of a line, or null for blank lines. */
export function lineIndentColumns(text: string, tabSize: number): number | null {
  const leading = /^[ \t]*/.exec(text)?.[0] ?? "";
  if (leading.length === text.length) return null;
  return countColumn(leading, tabSize);
}

function nearestIndent(state: EditorState, lineNumber: number, step: 1 | -1): number {
  const { doc } = state;
  for (let i = 1, n = lineNumber + step; i <= BLANK_LINE_SEARCH; i++, n += step) {
    if (n < 1 || n > doc.lines) return 0;
    const indent = lineIndentColumns(doc.line(n).text, state.tabSize);
    if (indent !== null) return indent;
  }
  return 0;
}

/** Columns at which guides are drawn for a given indentation width. */
export function guideColumns(indent: number, unit: number): number[] {
  const columns: number[] = [];
  for (let column = 0; column < indent; column += unit) columns.push(column);
  return columns;
}

const decorationCache = new Map<string, Decoration>();

function guideDecoration(columns: readonly number[]): Decoration {
  const key = columns.join(",");
  let decoration = decorationCache.get(key);
  if (!decoration) {
    const images = columns.map(() => "linear-gradient(var(--border-subtle), var(--border-subtle))");
    const positions = columns.map((column) => `${column}ch 0`);
    decoration = Decoration.line({
      class: "cm-indent-guides",
      attributes: {
        style: `background-image: ${images.join(", ")}; background-position: ${positions.join(", ")}`,
      },
    });
    decorationCache.set(key, decoration);
  }
  return decoration;
}

function buildGuides(view: EditorView): DecorationSet {
  const { state } = view;
  const unit = Math.max(1, getIndentUnit(state));
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = state.doc.lineAt(pos);
      const indent =
        lineIndentColumns(line.text, state.tabSize) ??
        Math.min(nearestIndent(state, line.number, -1), nearestIndent(state, line.number, 1));
      const columns = guideColumns(indent, unit);
      if (columns.length > 0) builder.add(line.from, line.from, guideDecoration(columns));
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const indentGuidesPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildGuides(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.startState.tabSize !== update.state.tabSize ||
        update.startState.facet(indentUnit) !== update.state.facet(indentUnit)
      ) {
        this.decorations = buildGuides(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const indentGuidesTheme = EditorView.theme({
  ".cm-indent-guides": {
    backgroundOrigin: "content-box",
    backgroundRepeat: "no-repeat",
    backgroundSize: "1px 100%",
  },
});

/** Vertical lines at each indentation level. */
export function indentGuidesExtension(): Extension {
  return [indentGuidesPlugin, indentGuidesTheme];
}
