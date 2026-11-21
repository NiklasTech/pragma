import { useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState, type Text } from "@codemirror/state";
import { getCM } from "@replit/codemirror-vim";
import type { AIProvider, ProviderConfig } from "@/shared/stores/ai";
import type { CreateEditorExtensions } from "./useEditorExtensions";

interface EditorMountContext {
  containerRef: RefObject<HTMLDivElement | null>;
  viewRef: RefObject<EditorView | null>;
  content: string;
  onChange: (value: string) => void;
  vimEnabled: boolean;
  filePath: string;
  createExtensions: CreateEditorExtensions;
  canComplete: boolean;
  completionDebounce: number;
  completionTriggerCharacters: string[];
  nextEdit: boolean;
  activeProvider: AIProvider;
  activeModel: string;
  providerConfig: ProviderConfig;
  setEditorView: Dispatch<SetStateAction<EditorView | null>>;
  setVimMode: (mode: string | null) => void;
  setCursorPos: (pos: { line: number; column: number }) => void;
  /** Where the tab was when its editor last unmounted, restored on mount. */
  restore: { cursor: { line: number; column: number }; scrollTop: number } | null;
  saveScrollTop: (scrollTop: number) => void;
}

function cursorOffset(doc: Text, cursor: { line: number; column: number }): number {
  if (cursor.line < 1) return 0;
  const line = doc.line(Math.min(cursor.line, doc.lines));
  return line.from + Math.max(0, Math.min(cursor.column - 1, line.length));
}

export function useEditorMount({
  containerRef,
  viewRef,
  content,
  onChange,
  vimEnabled,
  filePath,
  createExtensions,
  canComplete,
  completionDebounce,
  completionTriggerCharacters,
  nextEdit,
  activeProvider,
  activeModel,
  providerConfig,
  setEditorView,
  setVimMode,
  setCursorPos,
  restore,
  saveScrollTop,
}: EditorMountContext): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let state = EditorState.create({
      doc: content,
      extensions: createExtensions(
        (value) => onChange(value),
        (pos) => setCursorPos(pos),
        vimEnabled,
        {
          enabled: canComplete,
          debounceMs: completionDebounce,
          triggerCharacters: completionTriggerCharacters,
          filePath,
          provider: activeProvider,
          model: activeModel,
          baseUrl: providerConfig.baseUrl,
          nextEdit,
        },
      ),
    });
    if (restore) {
      state = state.update({
        selection: { anchor: cursorOffset(state.doc, restore.cursor) },
      }).state;
    }
    const view = new EditorView({ state, parent: container });
    viewRef.current = view;
    setEditorView(view);

    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    setCursorPos({ line: line.number, column: head - line.from + 1 });

    let scrollTop = restore?.scrollTop ?? 0;
    const onScroll = () => {
      scrollTop = view.scrollDOM.scrollTop;
    };
    view.scrollDOM.addEventListener("scroll", onScroll, { passive: true });
    const restoreFrame =
      scrollTop > 0
        ? requestAnimationFrame(() => {
            view.scrollDOM.scrollTop = scrollTop;
          })
        : 0;

    let vimModeHandler: ((e: { mode: string }) => void) | null = null;
    if (vimEnabled) {
      const cm = getCM(view);
      if (cm) {
        vimModeHandler = (e: { mode: string }) => setVimMode(e.mode);
        cm.on("vim-mode-change", vimModeHandler);
        setVimMode("normal");
      }
    }

    return () => {
      cancelAnimationFrame(restoreFrame);
      view.scrollDOM.removeEventListener("scroll", onScroll);
      saveScrollTop(scrollTop);
      if (vimModeHandler) {
        const cm = getCM(view);
        if (cm) cm.off("vim-mode-change", vimModeHandler);
      }
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
      setVimMode(null);
    };
    // The editor instance must survive content edits; external updates are synced separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, vimEnabled]);
}
