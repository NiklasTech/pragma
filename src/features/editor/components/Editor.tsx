import { useEffect, useRef, useState, useCallback } from "react";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { Compartment, EditorState, StateEffect, type Extension } from "@codemirror/state";
import { pragmaDarkTheme, themeCompartment } from "@/shared/lib/theme/editor-theme";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { vim, getCM } from "@replit/codemirror-vim";
import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore } from "@/shared/stores/editor";
import { useLayoutStore } from "@/shell/layout";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAutoSave } from "@/shared/hooks/useAutoSave";
import { useTheme } from "@/theme";
import { useSelectionAskAi } from "@/shared/hooks/useSelectionAskAi";
import { loadLanguage } from "@/shared/lib/editor/languages";
import { detectLanguage } from "@/shared/lib/language";
import { matchShortcut } from "@/shared/lib/shortcuts";
import { ghostTextExtension, type GhostTextConfig } from "./extensions/ghost-text";
// vim-setup hooks currently unused — re-enable when vim save/close integration is needed
import { EditorStatusbar } from "./EditorStatusbar";
import { StickyLinesOverlay } from "./StickyLinesOverlay";
import { InlineDiff } from "./InlineDiff";
import { SelectionAskAi } from "./SelectionAskAi";

const languageCompartment = new Compartment();
const ghostTextCompartment = new Compartment();
const externalUpdate = StateEffect.define<void>();

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

function FileEditor({
  content,
  fileName,
  filePath,
  tabId,
  onChange,
  vimEnabled,
}: {
  content: string;
  fileName: string;
  filePath: string;
  tabId: string;
  onChange: (value: string) => void;
  vimEnabled: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [vimMode, setVimMode] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const { themeId, resolvedMode } = useTheme();
  const [hasSelection, setHasSelection] = useState(false);
  const selectedTextRef = useRef("");
  const { handleBlur } = useAutoSave();
  const activeProvider = useAIStore((state) => state.activeProvider);
  const activeModel = useAIStore((state) => state.activeModel);
  const providers = useAIStore((state) => state.providers);
  const inlineCompletion = useAIStore((state) => state.inlineCompletion);
  const completionDebounce = useAIStore((state) => state.completionDebounce);
  const completionTriggerCharacters = useAIStore((state) => state.completionTriggerCharacters);
  const apiKeyRefs = useAIStore((state) => state.apiKeyRefs);
  const loadKeyStatus = useAIStore((state) => state.loadKeyStatus);
  const providerConfig = providers[activeProvider];
  const canComplete =
    inlineCompletion &&
    (activeProvider === "ollama" || apiKeyRefs[activeProvider] !== null) &&
    !(activeProvider === "custom" && !providerConfig.baseUrl);

  const createExtensions = useCallback(
    (
      onChangeValue: (value: string) => void,
      onCursorChange: (pos: { line: number; column: number }) => void,
      enableVim: boolean,
      ghostConfig: GhostTextConfig,
    ): Extension[] => {
      const extensions: Extension[] = [
        languageCompartment.of([]),
        themeCompartment.of(pragmaDarkTheme),
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        ghostTextCompartment.of(ghostTextExtension(ghostConfig)),
        baseTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const isExternal = update.transactions.some((tr) =>
              tr.effects.some((e) => e.is(externalUpdate)),
            );
            if (!isExternal) {
              onChangeValue(update.state.doc.toString());
            }
          }
          if (update.selectionSet) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            onCursorChange({ line: line.number, column: head - line.from + 1 });

            const { from, to } = update.state.selection.main;
            const selected = from !== to;
            setHasSelection(selected);
            selectedTextRef.current = selected ? update.state.doc.sliceString(from, to) : "";
          }
        }),
        EditorState.tabSize.of(2),
        EditorState.allowMultipleSelections.of(true),
      ];

      if (enableVim) {
        extensions.unshift(vim({ status: false }));
        extensions.push(drawSelection());
      }

      return extensions;
    },
    [],
  );

  useEffect(() => {
    if (activeProvider !== "ollama") {
      void loadKeyStatus(activeProvider);
    }
  }, [activeProvider, loadKeyStatus]);

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

  const handleEditWithAI = useCallback(() => {
    if (!hasSelection || selectedTextRef.current.length === 0) return;

    const language = detectLanguage(fileName);
    useAIEditStore.getState().startEdit({
      originalCode: selectedTextRef.current,
      filePath,
      fileTabId: tabId,
      language,
    });
    useLayoutStore.getState().setAIMode("drawer-right");
  }, [hasSelection, fileName, filePath, tabId]);

  const captureActiveSelection = useCallback(() => {
    if (!hasSelection || selectedTextRef.current.length === 0) return null;
    return selectedTextRef.current;
  }, [hasSelection]);

  const askFromSelection = useCallback(() => {
    handleEditWithAI();
  }, [handleEditWithAI]);

  const { askPopup, setAskPopup, onAskFromSelection } = useSelectionAskAi({
    captureActiveSelection,
    askFromSelection,
  });

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(pragmaDarkTheme),
    });
  }, [themeId, resolvedMode]);

  const shortcuts = useSettingsStore((state) => state.shortcuts);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (matchShortcut(e, shortcuts["edit.editWithAI"])) {
        e.preventDefault();
        const text = captureActiveSelection();
        if (text) handleEditWithAI();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captureActiveSelection, handleEditWithAI, shortcuts]);

  useEffect(() => {
    if (!viewRef.current) return;

    const current = viewRef.current.state.doc.toString();
    if (current !== content) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: content },
        effects: externalUpdate.of(),
      });
    }
  }, [content]);

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

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: ghostTextCompartment.reconfigure(
        ghostTextExtension({
          enabled: canComplete,
          debounceMs: completionDebounce,
          triggerCharacters: completionTriggerCharacters,
          filePath,
          provider: activeProvider,
          model: activeModel,
          baseUrl: providerConfig.baseUrl,
        }),
      ),
    });
  }, [
    canComplete,
    completionDebounce,
    completionTriggerCharacters,
    filePath,
    activeProvider,
    activeModel,
    providerConfig.baseUrl,
  ]);

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
        {askPopup && (
          <SelectionAskAi
            state="open"
            x={askPopup.x}
            y={askPopup.y}
            onAsk={onAskFromSelection}
            onDismiss={() => setAskPopup(null)}
          />
        )}
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

interface EditorProps {
  panelId?: string;
}

export function Editor({ panelId }: EditorProps) {
  const { tabs, getPanelActiveTabId, updateFileContent, closeTab } = useEditorStore();
  const vimEnabled = useSettingsStore((state) => state.editor.vimMode);

  const activeTabId = getPanelActiveTabId(panelId ?? null);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  if (!activeTab) {
    return (
      <div className="flex h-full w-full items-center justify-center text-ui-sm text-fg-subtle">
        <span>No file open</span>
      </div>
    );
  }

  if (activeTab.kind === "diff") {
    const isAiEdit = !!activeTab.sourceTabId;

    const handleAccept = (modified: string) => {
      if (activeTab.sourceTabId) {
        updateFileContent(activeTab.sourceTabId, modified);
      }
      closeTab(activeTab.id);
      useAIEditStore.getState().acceptEdit();
    };

    const handleReject = () => {
      closeTab(activeTab.id);
      useAIEditStore.getState().rejectEdit();
    };

    return (
      <div className="flex h-full w-full flex-col">
        <div className="relative min-h-0 flex-1">
          <InlineDiff
            original={activeTab.original}
            modified={activeTab.modified}
            patchText={activeTab.patchText}
            filePath={activeTab.path}
            onAccept={isAiEdit ? handleAccept : undefined}
            onReject={isAiEdit ? handleReject : undefined}
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
      filePath={activeTab.path}
      tabId={activeTab.id}
      onChange={(value) => updateFileContent(activeTab.id, value)}
      vimEnabled={vimEnabled}
    />
  );
}
