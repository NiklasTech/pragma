import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { forEachDiagnostic } from "@codemirror/lint";
import { getSearchQuery, searchPanelOpen } from "@codemirror/search";
import { gitChangeRanges } from "./git-change-gutter";

const MAX_SEARCH_MARKS = 2000;
const MIN_MARK_HEIGHT = 2;

interface OverviewMark {
  className: string;
  top: number;
  height: number;
  pos: number;
}

interface OverviewLayout {
  top: number;
  height: number;
  marks: OverviewMark[];
}

class MarkCollector {
  readonly marks: OverviewMark[] = [];
  private readonly lastTop = new Map<string, number>();

  constructor(
    private readonly view: EditorView,
    private readonly scale: number,
  ) {}

  /** Without `to` the mark is a thin line at `from`, otherwise it spans the lines up to `to`. */
  add(className: string, from: number, to?: number): void {
    const { view } = this;
    const offset = view.documentPadding.top;
    const top = Math.round((offset + view.lineBlockAt(from).top) * this.scale);
    // Marks of one kind on the same pixel row add nothing.
    if (this.lastTop.get(className) === top) return;
    this.lastTop.set(className, top);
    const bottom =
      to === undefined ? top : Math.round((offset + view.lineBlockAt(to).bottom) * this.scale);
    this.marks.push({ className, top, height: Math.max(MIN_MARK_HEIGHT, bottom - top), pos: from });
  }
}

function collectMarks(view: EditorView, trackHeight: number): OverviewMark[] {
  const { state } = view;
  const collector = new MarkCollector(
    view,
    trackHeight / Math.max(view.contentHeight, trackHeight),
  );

  for (const change of gitChangeRanges(state)) {
    if (change.kind === "deleted") collector.add("cm-overview-git-deleted", change.from);
    else collector.add(`cm-overview-git-${change.kind}`, change.from, change.to);
  }

  const query = getSearchQuery(state);
  if (searchPanelOpen(state) && query.valid && query.search) {
    const cursor = query.getCursor(state);
    for (let i = 0, match = cursor.next(); !match.done && i < MAX_SEARCH_MARKS; i++) {
      collector.add("cm-overview-search", match.value.from);
      match = cursor.next();
    }
  }

  forEachDiagnostic(state, (diagnostic, from) => {
    const severity = diagnostic.severity === "hint" ? "info" : diagnostic.severity;
    collector.add(`cm-overview-${severity}`, from);
  });

  collector.add("cm-overview-cursor", state.selection.main.head);
  return collector.marks;
}

class OverviewRuler {
  private readonly dom: HTMLElement;

  constructor(private readonly view: EditorView) {
    this.dom = document.createElement("div");
    this.dom.className = "cm-overview";
    this.dom.setAttribute("aria-hidden", "true");
    this.dom.addEventListener("mousedown", this.onMouseDown);
    view.dom.appendChild(this.dom);
    this.schedule();
  }

  update(update: ViewUpdate): void {
    if (update.transactions.length > 0 || update.geometryChanged) this.schedule();
  }

  destroy(): void {
    this.dom.removeEventListener("mousedown", this.onMouseDown);
    this.dom.remove();
  }

  private schedule(): void {
    this.view.requestMeasure<OverviewLayout>({
      key: this,
      read: (view) => {
        const height = view.scrollDOM.clientHeight;
        return { top: view.scrollDOM.offsetTop, height, marks: collectMarks(view, height) };
      },
      write: (layout) => this.draw(layout),
    });
  }

  private draw({ top, height, marks }: OverviewLayout): void {
    this.dom.style.top = `${top}px`;
    this.dom.style.height = `${height}px`;
    const fragment = document.createDocumentFragment();
    for (const mark of marks) {
      const element = document.createElement("div");
      element.className = `cm-overview-mark ${mark.className}`;
      element.style.top = `${mark.top}px`;
      element.style.height = `${mark.height}px`;
      element.dataset.pos = String(mark.pos);
      fragment.appendChild(element);
    }
    this.dom.replaceChildren(fragment);
  }

  private readonly onMouseDown = (event: MouseEvent): void => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const pos = Number(target?.dataset.pos);
    if (!Number.isInteger(pos)) return;
    event.preventDefault();
    const clamped = Math.min(pos, this.view.state.doc.length);
    this.view.dispatch({ effects: EditorView.scrollIntoView(clamped, { y: "center" }) });
  };
}

const overviewTheme = EditorView.theme({
  ".cm-overview": {
    position: "absolute",
    right: "0",
    width: "8px",
    zIndex: "1",
    pointerEvents: "none",
  },
  ".cm-overview-mark": {
    position: "absolute",
    pointerEvents: "auto",
    cursor: "pointer",
    opacity: "0.85",
  },
  ".cm-overview-git-added, .cm-overview-git-modified, .cm-overview-git-deleted": {
    left: "0",
    width: "3px",
  },
  ".cm-overview-git-added": { background: "var(--color-status-success)" },
  ".cm-overview-git-modified": { background: "var(--color-status-info)" },
  ".cm-overview-git-deleted": { background: "var(--color-status-error)" },
  ".cm-overview-search": { left: "2px", width: "4px", background: "var(--color-accent)" },
  ".cm-overview-error, .cm-overview-warning, .cm-overview-info": { right: "0", width: "3px" },
  ".cm-overview-error": { background: "var(--color-status-error)" },
  ".cm-overview-warning": { background: "var(--color-status-warning)" },
  ".cm-overview-info": { background: "var(--color-status-info)" },
  ".cm-overview-cursor": { left: "0", right: "0", background: "var(--fg-muted)" },
});

/** Markers next to the scrollbar for diagnostics, search matches, git changes and the cursor. */
export function overviewRulerExtension(): Extension {
  return [ViewPlugin.define((view) => new OverviewRuler(view)), overviewTheme];
}
