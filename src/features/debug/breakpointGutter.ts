import { EditorView, gutter, GutterMarker } from "@codemirror/view";
import {
  RangeSet,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from "@codemirror/state";
import type { BreakpointKind, BreakpointMarkerSpec } from "./breakpointSettings";

export const setBreakpointMarkersEffect = StateEffect.define<BreakpointMarkerSpec[]>();

class BreakpointMarker extends GutterMarker {
  constructor(readonly kind: BreakpointKind) {
    super();
  }

  override eq(other: GutterMarker): boolean {
    return other instanceof BreakpointMarker && other.kind === this.kind;
  }

  override toDOM(): Node {
    const element = document.createElement("div");
    element.className = `cm-breakpoint-marker cm-breakpoint-${this.kind}`;
    return element;
  }
}

const breakpointMarkers: Record<BreakpointKind, BreakpointMarker> = {
  breakpoint: new BreakpointMarker("breakpoint"),
  conditional: new BreakpointMarker("conditional"),
  logpoint: new BreakpointMarker("logpoint"),
};

export const breakpointLinesField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(markers, tr) {
    const mapped = markers.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setBreakpointMarkersEffect)) {
        const ranges = effect.value
          .filter(({ line }) => line >= 1 && line <= tr.state.doc.lines)
          .map(({ line, kind }) => breakpointMarkers[kind].range(tr.state.doc.line(line).from));
        return RangeSet.of(ranges, true);
      }
    }
    return mapped;
  },
});

export function getBreakpointMarkers(state: EditorState): BreakpointMarkerSpec[] {
  const markers = state.field(breakpointLinesField, false);
  if (!markers) return [];

  const specs: BreakpointMarkerSpec[] = [];
  const iter = markers.iter();
  while (iter.value) {
    const kind = iter.value instanceof BreakpointMarker ? iter.value.kind : "breakpoint";
    specs.push({ line: state.doc.lineAt(iter.from).number, kind });
    iter.next();
  }
  return specs;
}

export function getBreakpointLines(state: EditorState): number[] {
  return getBreakpointMarkers(state).map(({ line }) => line);
}

export function breakpointGutter(
  onToggle: (line: number) => void,
  onEdit: (line: number) => void,
): Extension {
  return [
    breakpointLinesField,
    gutter({
      class: "cm-breakpoint-gutter",
      markers: (view) => view.state.field(breakpointLinesField),
      initialSpacer: () => breakpointMarkers.breakpoint,
      domEventHandlers: {
        mousedown: (view, line, event) => {
          if (!(event instanceof MouseEvent) || event.button !== 0) return false;
          onToggle(view.state.doc.lineAt(line.from).number);
          return true;
        },
        contextmenu: (view, line, event) => {
          // Keeps the global editor context menu from opening on top of the editor dialog.
          event.stopPropagation();
          onEdit(view.state.doc.lineAt(line.from).number);
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
        position: "relative",
        width: "10px",
        height: "10px",
        margin: "0 3px",
        borderRadius: "50%",
        backgroundColor: "#e51400",
      },
      ".cm-breakpoint-conditional::after": {
        content: '""',
        position: "absolute",
        left: "2px",
        right: "2px",
        top: "3px",
        height: "4px",
        borderTop: "1px solid var(--color-bg-root)",
        borderBottom: "1px solid var(--color-bg-root)",
      },
      ".cm-breakpoint-logpoint": {
        width: "8px",
        height: "8px",
        margin: "1px 4px",
        borderRadius: "1px",
        transform: "rotate(45deg)",
      },
    }),
  ];
}
