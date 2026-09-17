import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
  type Text,
} from "@codemirror/state";

import { lspInlayHint, type LspInlayHint } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";

const INLAY_HINT_DEBOUNCE_MS = 200;

export interface InlayHintRender {
  pos: number;
  label: string;
  paddingLeft: boolean;
  paddingRight: boolean;
}

export function lspInlayHintPosition(doc: Text, line: number, character: number): number {
  const targetLine = doc.line(Math.min(Math.max(line, 0) + 1, doc.lines));
  const offset = Math.max(character, 0);
  return Math.min(targetLine.from + offset, targetLine.to);
}

export function toInlayHintRenders(hints: LspInlayHint[], doc: Text): InlayHintRender[] {
  return hints
    .filter((hint) => hint.label.length > 0)
    .map((hint) => ({
      pos: lspInlayHintPosition(doc, hint.position.line, hint.position.character),
      label: hint.label,
      paddingLeft: hint.paddingLeft,
      paddingRight: hint.paddingRight,
    }))
    .sort((left, right) => left.pos - right.pos);
}

class InlayHintWidget extends WidgetType {
  constructor(private readonly hint: InlayHintRender) {
    super();
  }

  eq(other: InlayHintWidget): boolean {
    return (
      this.hint.pos === other.hint.pos &&
      this.hint.label === other.hint.label &&
      this.hint.paddingLeft === other.hint.paddingLeft &&
      this.hint.paddingRight === other.hint.paddingRight
    );
  }

  toDOM(): HTMLElement {
    const dom = document.createElement("span");
    dom.className = "cm-lsp-inlay-hint";
    dom.textContent = this.hint.label;
    dom.style.cssText =
      "font-style: italic; opacity: 0.65; user-select: none; pointer-events: none;";
    if (this.hint.paddingLeft) {
      dom.style.marginLeft = "3px";
    }
    if (this.hint.paddingRight) {
      dom.style.marginRight = "3px";
    }
    return dom;
  }
}

export function inlayHintDecorations(renders: InlayHintRender[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const render of renders) {
    builder.add(
      render.pos,
      render.pos,
      Decoration.widget({ widget: new InlayHintWidget(render), side: 1 }),
    );
  }
  return builder.finish();
}

export const setInlayHints = StateEffect.define<DecorationSet>();

export const inlayHintsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (effect.is(setInlayHints)) {
        next = effect.value;
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

class InlayHintsView {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private requestSeq = 0;
  private destroyed = false;

  constructor(
    private readonly view: EditorView,
    private readonly language: string,
    private readonly filePath: string,
  ) {
    this.schedule();
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) {
      this.schedule();
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, INLAY_HINT_DEBOUNCE_MS);
  }

  private async refresh(): Promise<void> {
    const view = this.view;
    const ranges = view.visibleRanges;
    if (ranges.length === 0) {
      return;
    }

    const seq = ++this.requestSeq;
    const doc = view.state.doc;
    const first = doc.lineAt(ranges[0].from);
    const last = doc.lineAt(ranges[ranges.length - 1].to);
    const range = {
      start: { line: first.number - 1, character: 0 },
      end: { line: last.number - 1, character: last.length },
    };

    let hints: LspInlayHint[];
    try {
      await flushLspDocumentSync(this.language, this.filePath, doc.toString()).catch(() => {});
      hints = await lspInlayHint(this.language, this.filePath, range);
    } catch {
      hints = [];
    }

    if (this.destroyed || seq !== this.requestSeq) {
      return;
    }

    this.view.dispatch({
      effects: setInlayHints.of(inlayHintDecorations(toInlayHintRenders(hints, view.state.doc))),
    });
  }
}

export function lspInlayHintsExtension(language: string, filePath: string): Extension {
  return [
    inlayHintsField,
    ViewPlugin.define((view) => new InlayHintsView(view, language, filePath)),
  ];
}
