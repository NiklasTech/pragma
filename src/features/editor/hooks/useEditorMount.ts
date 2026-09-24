import { useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
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
  activeProvider: AIProvider;
  activeModel: string;
  providerConfig: ProviderConfig;
  setEditorView: Dispatch<SetStateAction<EditorView | null>>;
  setVimMode: Dispatch<SetStateAction<string | null>>;
  setCursorPos: Dispatch<SetStateAction<{ line: number; column: number }>>;
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
  activeProvider,
  activeModel,
  providerConfig,
  setEditorView,
  setVimMode,
  setCursorPos,
}: EditorMountContext): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const view = new EditorView({
      state: EditorState.create({
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
          },
        ),
      }),
      parent: container,
    });
    viewRef.current = view;
    setEditorView(view);

    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    setCursorPos({ line: line.number, column: head - line.from + 1 });

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
      if (vimModeHandler) {
        const cm = getCM(view);
        if (cm) cm.off("vim-mode-change", vimModeHandler);
      }
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
      setVimMode(null);
      setCursorPos({ line: 1, column: 1 });
    };
    // The editor instance must survive content edits; external updates are synced separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, vimEnabled]);
}
