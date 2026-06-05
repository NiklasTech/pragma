import { useEffect, useRef } from "react";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { useEditorStore } from "@/stores/editor";

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
    caretColor: "var(--foreground, #e8e8ea)",
  },
  ".cm-line": {
    padding: "0 12px 0 8px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--background, #0f0f10)",
    borderRight: "1px solid var(--border, #3a3a3e)",
    color: "var(--muted-foreground, #8a8a8f)",
    fontFamily: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: "14px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--muted, #242427)",
    color: "var(--foreground, #e8e8ea)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--muted, #242427)",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(124, 106, 247, 0.3)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--foreground, #e8e8ea)",
    borderLeftWidth: "2px",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--secondary, #242427)",
    borderColor: "var(--border, #3a3a3e)",
    color: "var(--foreground, #e8e8ea)",
  },
});

function createExtensions(onChange: (value: string) => void): Extension[] {
  return [
    lineNumbers(),
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    baseTheme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
    EditorState.tabSize.of(2),
    EditorState.allowMultipleSelections.of(true),
  ];
}

export function Editor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef<(value: string) => void>(() => {});

  const { openFiles, activeTabId, updateFileContent } = useEditorStore();
  const activeFile = openFiles.find((f) => f.id === activeTabId) ?? null;

  onChangeRef.current = activeFile ? (value) => updateFileContent(activeFile.id, value) : () => {};

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: activeFile?.content ?? "",
        extensions: createExtensions((value) => onChangeRef.current(value)),
      }),
      parent: container,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [activeFile?.id]);

  if (!activeFile) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        <span>No file open</span>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
