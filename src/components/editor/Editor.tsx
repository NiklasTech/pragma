import { useEffect, useRef, useState } from "react";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { pragmaDarkTheme, themeCompartment } from "@/lib/theme/editor-theme";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { vim, getCM } from "@replit/codemirror-vim";
import { useEditorStore } from "@/stores/editor";
import { useSettingsStore } from "@/stores/settings";
import { useSaveFile } from "@/hooks/useSaveFile";
import { useAutoSave } from "@/hooks/useAutoSave";
import { loadLanguage } from "@/lib/editor/languages";
// vim-setup hooks currently unused — re-enable when vim save/close integration is needed
import { EditorStatusbar } from "./EditorStatusbar";
import { StickyLinesOverlay } from "./StickyLinesOverlay";
import { InlineDiff } from "./InlineDiff";

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

function FileEditor({
  content,
  fileName,
  onChange,
  vimEnabled,
}: {
  content: string;
  fileName: string;
  onChange: (value: string) => void;
  vimEnabled: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [vimMode, setVimMode] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const { handleBlur } = useAutoSave();

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
  }, [content, vimEnabled]);

  useEffect(() => {
    if (!viewRef.current) return;

    let cancelled = false;
    loadLanguage(fileName)
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
  }, [fileName]);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <StickyLinesOverlay view={editorView} enabled={false} />
        <div
          ref={containerRef}
          className="h-full w-full"
          onBlur={(e) => {
            const related = e.relatedTarget as HTMLElement | null;
            if (related && containerRef.current?.contains(related)) {
              return;
            }
            handleBlur();
          }}
        />
      </div>
      <EditorStatusbar
        vimMode={vimMode}
        line={cursorPos.line}
        column={cursorPos.column}
        fileType={fileName}
      />
    </div>
  );
}

export function Editor() {
  const { tabs, activeTabId, updateFileContent, closeTab } = useEditorStore();
  const vimEnabled = useSettingsStore((state) => state.editor.vimMode);
  const saveFile = useSaveFile();

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  const handleClose = () => {
    if (activeTabId) {
      closeTab(activeTabId);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "w" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleClose();
      }
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void saveFile();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabId, saveFile]);

  if (!activeTab) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        <span>No file open</span>
      </div>
    );
  }

  if (activeTab.kind === "diff") {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="relative min-h-0 flex-1">
          <InlineDiff
            original={activeTab.original}
            modified={activeTab.modified}
            patchText={activeTab.patchText}
            filePath={activeTab.path}
          />
        </div>
        <EditorStatusbar vimMode={null} line={0} column={0} fileType={activeTab.path} />
      </div>
    );
  }

  return (
    <FileEditor
      content={activeTab.content}
      fileName={activeTab.name}
      onChange={(value) => updateFileContent(activeTab.id, value)}
      vimEnabled={vimEnabled}
    />
  );
}
