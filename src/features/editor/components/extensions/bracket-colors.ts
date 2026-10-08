import { RangeSetBuilder, type EditorState, type Extension, type Text } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { NodeProp, type SyntaxNode } from "@lezer/common";

const OPEN_BRACKETS = new Set(["(", "[", "{"]);
const BRACKETS = new Set(["(", ")", "[", "]", "{", "}"]);
const DEPTH_COLORS = ["var(--syntax-function)", "var(--syntax-keyword)", "var(--syntax-type)"];
const depthDecorations = DEPTH_COLORS.map((_, depth) =>
  Decoration.mark({ class: `cm-bracket-${depth}` }),
);

function isOpenBracket(node: SyntaxNode, doc: Text): boolean {
  return (
    node.to - node.from === 1 &&
    node.type.prop(NodeProp.closedBy) !== undefined &&
    OPEN_BRACKETS.has(doc.sliceString(node.from, node.to))
  );
}

/** Number of bracketed containers around the container the bracket belongs to. */
function bracketDepth(bracket: SyntaxNode, doc: Text): number {
  let depth = 0;
  for (let node = bracket.parent?.parent ?? null; node; node = node.parent) {
    const first = node.firstChild;
    if (first && first.from === node.from && isOpenBracket(first, doc)) depth++;
  }
  return depth;
}

/** Calls `f` with the position and nesting depth of each bracket token in the range. */
export function forEachBracket(
  state: EditorState,
  from: number,
  to: number,
  f: (pos: number, depth: number) => void,
): void {
  const { doc } = state;
  syntaxTree(state).iterate({
    from,
    to,
    enter: (ref) => {
      if (ref.to - ref.from !== 1) return;
      const { type } = ref;
      if (!type.prop(NodeProp.closedBy) && !type.prop(NodeProp.openedBy)) return;
      if (!BRACKETS.has(doc.sliceString(ref.from, ref.to))) return;
      f(ref.from, bracketDepth(ref.node, doc));
    },
  });
}

function buildColors(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    forEachBracket(view.state, from, to, (pos, depth) => {
      builder.add(pos, pos + 1, depthDecorations[depth % depthDecorations.length]);
    });
  }
  return builder.finish();
}

const bracketColorsPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildColors(view);
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildColors(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const bracketColorsTheme = EditorView.theme(
  Object.fromEntries(
    DEPTH_COLORS.flatMap((color, depth) => [
      [`.cm-bracket-${depth}`, { color }],
      // Wins over syntax highlighting spans nested inside the bracket mark.
      [`.cm-bracket-${depth} *`, { color }],
    ]),
  ),
);

/** Colors matching bracket pairs by nesting depth, based on the syntax tree. */
export function bracketColorsExtension(): Extension {
  return [bracketColorsPlugin, bracketColorsTheme];
}
