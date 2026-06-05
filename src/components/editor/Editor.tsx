import { useEffect, useRef, useState } from "react";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { pragmaDarkTheme, themeCompartment } from "@/lib/theme/editor-theme";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { vim, getCM } from "@replit/codemirror-vim";
import { useEditorStore } from "@/stores/editor";
import { useSettingsStore } from "@/stores/settings";
import { useSaveFile } from "@/hooks/useSaveFile";
import { loadLanguage } from "@/lib/editor/languages";
import { registerVimSave, registerVimClose } from "./vim-setup";
import { VimStatus } from "./vim-status";

const languageCompartment = new Compartment();

const baseTheme = EditorView.theme({
  "&": {
    fontSize: "14px",
    fontFamily: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
    height: "100%",
  },
  ".cm-scroller": {
    overflow: "auto",
    lineHeight: "1.6",
  },
  ".cm-content": {
    padding: "8px 0",
    caretColor: "var(--editor-cursor)",
  },
  ".cm-line": {
    padding: "0 12px 0 8px",
  },
  ".cm-gutters": {
    fontFamily: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: "14px",
  },
});

function createExtensions(
  onChange: (value: string) => void,
  onCursorChange: (pos: { line: number; column: number }) => void,
  vimEnabled: boolean,
): Extension[] {
  const extensions: Extension[] = [
    languageCompartment.of([]),
    themeCompartment.of(pragmaDarkTheme),
    lineNumbers(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    baseTheme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
      if (update.selectionSet) {
        const head = update.state.selection.main.head;
        const line = update.state.doc.lineAt(head);
        onCursorChange({ line: line.number, column: head - line.from + 1 });
      }
    }),
    EditorState.tabSize.of(2),
    EditorState.allowMultipleSelections.of(true),
  ];

  if (vimEnabled) {
    extensions.unshift(vim({ status: false }));
    extensions.push(drawSelection());
  }

  return extensions;
}

export function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef<(value: string) => void>(() => {});
  const saveRef = useRef(() => {});
  const closeRef = useRef(() => {});

  const { openFiles, activeTabId, updateFileContent, closeFile } = useEditorStore();
  const vimEnabled = useSettingsStore((state) => state.editor.vimMode);
  const saveFile = useSaveFile();

  const [vimMode, setVimMode] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });

  const activeFile = openFiles.find((f) => f.id === activeTabId) ?? null;

  onChangeRef.current = activeFile ? (value) => updateFileContent(activeFile.id, value) : () => {};
  saveRef.current = () => {
    void saveFile();
  };
  closeRef.current = () => {
    if (activeTabId) {
      closeFile(activeTabId);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: activeFile?.content ?? "",
        extensions: createExtensions(
          (value) => onChangeRef.current(value),
          (pos) => setCursorPos(pos),
          vimEnabled,
        ),
      }),
      parent: container,
    });
    viewRef.current = view;

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

    const unregisterSave = registerVimSave(() => saveRef.current());
    const unregisterClose = registerVimClose(() => closeRef.current());

    return () => {
      if (vimModeHandler) {
        const cm = getCM(view);
        if (cm) cm.off("vim-mode-change", vimModeHandler);
      }
      unregisterSave();
      unregisterClose();
      view.destroy();
      viewRef.current = null;
      setVimMode(null);
      setCursorPos({ line: 1, column: 1 });
    };
  }, [activeFile?.id, vimEnabled]);

  useEffect(() => {
    if (!viewRef.current || !activeFile) return;

    let cancelled = false;

    loadLanguage(activeFile.name)
      .then((ext) => {
        if (cancelled || !viewRef.current) return;
        viewRef.current.dispatch({
          effects: languageCompartment.reconfigure(ext),
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeFile?.id]);

  if (!activeFile) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        <span>No file open</span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={containerRef} className="min-h-0 flex-1" />
      <VimStatus
        mode={vimMode}
        line={cursorPos.line}
        column={cursorPos.column}
        fileType={activeFile.name}
      />
    </div>
  );
}
