import { EditorView, keymap, ViewPlugin, Decoration, type DecorationSet } from "@codemirror/view";
import { StateEffect, StateField, type Extension, type Text } from "@codemirror/state";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useEditorStore } from "@/shared/stores/editor";
import { detectLanguage } from "@/shared/lib/language";
import { lspDefinition, type LspDefinitionTarget } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

export function positionToLsp(doc: Text, pos: number): { line: number; character: number } {
  const line = doc.lineAt(pos);
  return { line: line.number - 1, character: pos - line.from };
}

export async function navigateToLocation(target: LspDefinitionTarget): Promise<void> {
  const store = useEditorStore.getState();
  const existing = store.tabs.find((tab) => tab.kind === "file" && tab.path === target.filePath);

  let tabId: string;
  if (existing) {
    tabId = existing.id;
    store.setActiveTab(tabId);
  } else {
    const result = await invoke<FileReadResult>("read_text_file", { path: target.filePath });
    store.openFile({
      id: result.path,
      path: result.path,
      name: result.name,
      content: result.content,
      originalContent: result.content,
      isModified: false,
      language: detectLanguage(result.name),
    });
    tabId = result.path;
  }

  store.goToPosition(tabId, { line: target.line + 1, column: target.character + 1 });
}

async function resolveDefinitionTarget(
  language: string,
  filePath: string,
  line: number,
  character: number,
  content?: string,
): Promise<LspDefinitionTarget | null> {
  if (content !== undefined) {
    await flushLspDocumentSync(language, filePath, content).catch(() => {});
  }
  return lspDefinition(language, filePath, line, character);
}

export async function jumpToDefinition(
  language: string,
  filePath: string,
  line: number,
  character: number,
  content?: string,
): Promise<void> {
  let target: LspDefinitionTarget | null;
  try {
    target = await resolveDefinitionTarget(language, filePath, line, character, content);
  } catch (error) {
    console.error("LSP definition request failed", error);
    toast.error(error instanceof Error ? error.message : String(error));
    return;
  }
  if (!target) {
    return;
  }
  await navigateToLocation(target);
}

export function coordsToPos(view: EditorView, clientX: number, clientY: number): number | null {
  const rect = view.contentDOM.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    return null;
  }
  return view.posAtCoords({ x: clientX, y: clientY });
}

export function goToDefinitionAtCoords(
  view: EditorView,
  language: string,
  filePath: string,
  clientX: number,
  clientY: number,
): void {
  const pos = coordsToPos(view, clientX, clientY);
  if (pos === null) {
    return;
  }
  const { line, character } = positionToLsp(view.state.doc, pos);
  void jumpToDefinition(language, filePath, line, character, view.state.doc.toString());
}

export async function hasDefinitionAtCoords(
  view: EditorView,
  language: string,
  filePath: string,
  clientX: number,
  clientY: number,
): Promise<boolean | null> {
  const pos = coordsToPos(view, clientX, clientY);
  if (pos === null) {
    return null;
  }
  const { line, character } = positionToLsp(view.state.doc, pos);
  try {
    const target = await resolveDefinitionTarget(
      language,
      filePath,
      line,
      character,
      view.state.doc.toString(),
    );
    return target !== null;
  } catch {
    return false;
  }
}

export const setDefinitionLink = StateEffect.define<{ from: number; to: number } | null>();

const definitionLinkMark = Decoration.mark({ class: "cm-lsp-definition-link" });

export const definitionLinkField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDefinitionLink)) {
        if (effect.value === null) {
          return Decoration.none;
        }
        return Decoration.set([definitionLinkMark.range(effect.value.from, effect.value.to)]);
      }
    }
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const HOVER_DEBOUNCE_MS = 100;

class DefinitionLinkView {
  private hoverTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMouse: { x: number; y: number } | null = null;
  private hoverPos: number | null = null;
  private hoverTarget: LspDefinitionTarget | null = null;
  private requestSeq = 0;

  constructor(
    private readonly view: EditorView,
    private readonly language: string,
    private readonly filePath: string,
  ) {
    window.addEventListener("keydown", this.onKeyChange);
    window.addEventListener("keyup", this.onKeyChange);
    window.addEventListener("blur", this.onWindowBlur);
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyChange);
    window.removeEventListener("keyup", this.onKeyChange);
    window.removeEventListener("blur", this.onWindowBlur);
    this.cancelHover();
  }

  onMouseMove(event: MouseEvent): void {
    this.lastMouse = { x: event.clientX, y: event.clientY };
    if (!event.ctrlKey && !event.metaKey) {
      if (this.hoverPos !== null) {
        this.clearLink();
      }
      return;
    }
    this.scheduleHover(event.clientX, event.clientY);
  }

  onMouseLeave(): void {
    this.lastMouse = null;
    this.clearLink();
  }

  onMouseDown(event: MouseEvent, view: EditorView): boolean {
    if (!(event.ctrlKey || event.metaKey) || event.button !== 0) {
      return false;
    }
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) {
      return false;
    }
    event.preventDefault();

    if (pos === this.hoverPos && this.hoverTarget) {
      void navigateToLocation(this.hoverTarget);
      return true;
    }

    const { line, character } = positionToLsp(view.state.doc, pos);
    void jumpToDefinition(this.language, this.filePath, line, character, view.state.doc.toString());
    return true;
  }

  private onKeyChange = (event: KeyboardEvent) => {
    if (event.key !== "Control" && event.key !== "Meta") {
      return;
    }
    if (event.type === "keyup") {
      this.clearLink();
      return;
    }
    if (this.lastMouse) {
      this.scheduleHover(this.lastMouse.x, this.lastMouse.y);
    }
  };

  private onWindowBlur = () => {
    this.clearLink();
  };

  private cancelHover() {
    if (this.hoverTimer !== null) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }

  private clearLink() {
    this.cancelHover();
    this.requestSeq += 1;
    this.hoverPos = null;
    this.hoverTarget = null;
    this.view.dispatch({ effects: setDefinitionLink.of(null) });
  }

  private scheduleHover(clientX: number, clientY: number) {
    this.cancelHover();
    this.hoverTimer = setTimeout(() => {
      this.hoverTimer = null;
      void this.updateLink(clientX, clientY);
    }, HOVER_DEBOUNCE_MS);
  }

  private async updateLink(clientX: number, clientY: number) {
    const pos = coordsToPos(this.view, clientX, clientY);
    if (pos === null || pos === this.hoverPos) {
      return;
    }

    const seq = ++this.requestSeq;
    const { line, character } = positionToLsp(this.view.state.doc, pos);

    let target: LspDefinitionTarget | null = null;
    try {
      target = await resolveDefinitionTarget(
        this.language,
        this.filePath,
        line,
        character,
        this.view.state.doc.toString(),
      );
    } catch {
      target = null;
    }

    if (seq !== this.requestSeq) {
      return;
    }

    this.hoverPos = pos;
    this.hoverTarget = target;

    const range = target ? this.view.state.wordAt(pos) : null;
    this.view.dispatch({
      effects: setDefinitionLink.of(range ? { from: range.from, to: range.to } : null),
    });
  }
}

export function lspDefinitionExtension(language: string, filePath: string): Extension {
  return [
    definitionLinkField,
    ViewPlugin.define((view) => new DefinitionLinkView(view, language, filePath), {
      eventHandlers: {
        mousemove(this: DefinitionLinkView, event: MouseEvent) {
          this.onMouseMove(event);
        },
        mouseleave(this: DefinitionLinkView) {
          this.onMouseLeave();
        },
        mousedown(this: DefinitionLinkView, event: MouseEvent, view: EditorView) {
          return this.onMouseDown(event, view);
        },
      },
    }),
    keymap.of([
      {
        key: "F12",
        run: (view) => {
          const { line, character } = positionToLsp(view.state.doc, view.state.selection.main.head);
          void jumpToDefinition(language, filePath, line, character, view.state.doc.toString());
          return true;
        },
      },
    ]),
  ];
}
