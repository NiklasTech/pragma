import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { lintGutter } from "@codemirror/lint";
import { Compartment, EditorState, StateEffect, type Extension } from "@codemirror/state";
import { useLspDiagnostics } from "@/shared/hooks/useLspDiagnostics";
import { useLspDocumentSync } from "@/shared/hooks/useLspDocumentSync";
import { useLspStatus } from "@/shared/hooks/useLspStatus";
import { useProblemsStore } from "@/shared/stores/problems";
import { createLinter } from "./extensions/diagnostics";
import {
  pragmaDarkTheme,
  themeCompartment,
  editorBaseTheme,
} from "@/shared/lib/theme/editor-theme";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { vim, getCM } from "@replit/codemirror-vim";
import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore } from "@/shared/stores/editor";
import { useLayoutStore } from "@/shell/layout";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAutoSave } from "@/shared/hooks/useAutoSave";
import { useTheme } from "@/theme";
import { loadLanguage } from "@/shared/lib/editor/languages";
import { detectLanguage } from "@/shared/lib/language";
import { matchShortcut } from "@/shared/lib/shortcuts";
import { ghostTextExtension, type GhostTextConfig } from "./extensions/ghost-text";
import { EditorStatusbar } from "./EditorStatusbar";
import { StickyLinesOverlay } from "./StickyLinesOverlay";
import { InlineDiff } from "./InlineDiff";

const languageCompartment = new Compartment();
const ghostTextCompartment = new Compartment();
const externalUpdate = StateEffect.define<void>();

function FileEditor({
  content,
  fileName,
  filePath,
  tabId,
  isModified,
  onChange,
  vimEnabled,
}: {
  content: string;
  fileName: string;
  filePath: string;
  tabId: string;
  isModified: boolean;
  onChange: (value: string) => void;
  vimEnabled: boolean;
}) {
  const language = detectLanguage(fileName);
  useLspDiagnostics();
  useLspStatus();
  useLspDocumentSync(language, filePath, content, isModified);

  const problems = useProblemsStore((state) => state.problems);
  const diagnostics = useMemo(
    () => problems.filter((p) => p.filePath === filePath),
    [problems, filePath],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const diagnosticsCompartmentRef = useRef(new Compartment());
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [vimMode, setVimMode] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const { themeId, resolvedMode } = useTheme();
  const [hasSelection, setHasSelection] = useState(false);
  const selectedTextRef = useRef("");
  const { handleBlur } = useAutoSave();
  const { tabSize, insertSpaces } = useSettingsStore((state) => state.editor);
  const tabStates = useEditorStore((s) => s.tabStates);
  const goToPosition = useEditorStore((s) => s.goToPosition);
  const pendingScroll = tabStates.find((s) => s.tabId === tabId)?.pendingScroll ?? null;
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
    (activeProvider === "ollama"
      ? true
      : activeProvider === "custom"
        ? Boolean(providerConfig.baseUrl)
        : apiKeyRefs[activeProvider] !== null);

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
        diagnosticsCompartmentRef.current.of([]),
        lintGutter(),
        lineNumbers(),
        history(),
        ghostTextCompartment.of(ghostTextExtension(ghostConfig)),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        drawSelection(),
        editorBaseTheme,
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
        EditorState.tabSize.of(tabSize),
        EditorState.allowMultipleSelections.of(true),
        indentUnit.of(insertSpaces ? " ".repeat(tabSize) : "\t"),
      ];

      if (enableVim) {
        extensions.unshift(vim({ status: false }));
      }

      return extensions;
    },
    [tabSize, insertSpaces],
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

  useEffect(() => {
    if (!viewRef.current || !pendingScroll) return;

    const view = viewRef.current;
    const doc = view.state.doc;
    const targetLine = Math.max(1, Math.min(pendingScroll.line, doc.lines));
    const line = doc.line(targetLine);
    const targetColumn = Math.max(1, Math.min(pendingScroll.column, line.length + 1));
    const pos = line.from + targetColumn - 1;

    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "center" }),
    });
    goToPosition(tabId, null);
  }, [pendingScroll, tabId, goToPosition]);

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

    viewRef.current.dispatch({
      effects: diagnosticsCompartmentRef.current.reconfigure(createLinter(diagnostics)),
    });
  }, [diagnostics]);

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
      </div>
      <EditorStatusbar
        vimMode={vimMode}
        line={cursorPos.line}
        column={cursorPos.column}
        fileType={fileName}
        filePath={filePath}
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
      isModified={activeTab.isModified}
      onChange={(value) => updateFileContent(activeTab.id, value)}
      vimEnabled={vimEnabled}
    />
  );
}
