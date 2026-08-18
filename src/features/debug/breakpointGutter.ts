import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import {
  RangeSet,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";

export const setBreakpointLinesEffect = StateEffect.define<number[]>();

class BreakpointMarker extends GutterMarker {
  override toDOM(): Node {
    const element = document.createElement("div");
    element.className = "cm-breakpoint-marker";
    return element;
  }
}

const breakpointMarker = new BreakpointMarker();

export const breakpointLinesField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(markers, tr) {
    const mapped = markers.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setBreakpointLinesEffect)) {
        const ranges = effect.value
          .filter((line) => line >= 1 && line <= tr.state.doc.lines)
          .map((line) => breakpointMarker.range(tr.state.doc.line(line).from));
        return RangeSet.of(ranges, true);
      }
    }
    return mapped;
  },
});

export function getBreakpointLines(state: EditorState): number[] {
  const markers = state.field(breakpointLinesField, false);
  if (!markers) return [];

  const lines: number[] = [];
  const iter = markers.iter();
  while (iter.value) {
    lines.push(state.doc.lineAt(iter.from).number);
    iter.next();
  }
  return lines;
}

export function breakpointGutter(onToggle: (line: number) => void): Extension {
  return [
    breakpointLinesField,
    gutter({
      class: "cm-breakpoint-gutter",
      markers: (view) => view.state.field(breakpointLinesField),
      initialSpacer: () => breakpointMarker,
      domEventHandlers: {
        mousedown: (view, line) => {
          onToggle(view.state.doc.lineAt(line.from).number);
          return true;
        },
      },
    }),
    EditorView.baseTheme({
      ".cm-breakpoint-gutter": {
        width: "16px",
        cursor: "pointer",
      },
      ".cm-breakpoint-marker": {
        width: "10px",
        height: "10px",
        margin: "0 3px",
        borderRadius: "50%",
        backgroundColor: "#e51400",
      },
    }),
  ];
}
