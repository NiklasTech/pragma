import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { EditorView } from "@codemirror/view";
import { Compartment } from "@codemirror/state";
import { externalUpdate } from "@/features/editor/compartments";
import { useLspDiagnostics } from "@/shared/hooks/useLspDiagnostics";
import { useLspDocumentSync } from "@/shared/hooks/useLspDocumentSync";
import { useLspStatus } from "@/shared/hooks/useLspStatus";
import { useProblemsStore } from "@/shared/stores/problems";
import { EditorEmptyState } from "./EditorEmptyState";
import { createLinter } from "./extensions/diagnostics";
import { useAIStore } from "@/shared/stores/ai";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore } from "@/shared/stores/editor";
import { useAgentStore } from "@/features/agent/store";
import { useLayoutStore } from "@/shell/layout";
import { useSettingsStore } from "@/shared/stores/settings";
import { useAutoSave } from "@/shared/hooks/useAutoSave";
import { useTheme } from "@/theme";
import { detectLanguage } from "@/shared/lib/language";
import { matchShortcut } from "@/shared/lib/shortcuts";
import { useOutlineCommand } from "@/features/editor/lsp/outline";
import { useDebugStore } from "@/features/debug/store";
import { EditorStatusbar } from "./EditorStatusbar";
import { ReferencesView } from "./ReferencesView";
import { StickyLinesOverlay } from "./StickyLinesOverlay";
import { InlineDiff } from "./InlineDiff";
import { useGitStore } from "@/shared/stores/git";
import { useEditorExtensions } from "@/features/editor/hooks/useEditorExtensions";
import { useEditorMount } from "@/features/editor/hooks/useEditorMount";
import { useEditorReconfiguration } from "@/features/editor/hooks/useEditorReconfiguration";
import { useLspEditorWiring } from "@/features/editor/hooks/useLspEditorWiring";
import { useEditorSearchEvents } from "@/features/editor/hooks/useEditorSearchEvents";
import { useEditorLanguageSync } from "@/features/editor/hooks/useEditorLanguageSync";
import { useBlameGutter } from "@/features/editor/hooks/useBlameGutter";

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
  useOutlineCommand();
  useLspDiagnostics();
  useLspStatus();
  useLspDocumentSync(language, filePath, content, isModified);

  const problems = useProblemsStore((state) => state.problems);
  const diagnostics = useMemo(
    () => problems.filter((p) => p.filePath === filePath),
    [problems, filePath],
  );

  const fileBreakpoints = useDebugStore((state) => state.breakpoints[filePath]);

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  const breakpointCompartmentRef = useRef(new Compartment());
  const diagnosticsCompartmentRef = useRef(new Compartment());
  const lspCompletionCompartmentRef = useRef(new Compartment());
  const lspDefinitionCompartmentRef = useRef(new Compartment());
  const lspHoverCompartmentRef = useRef(new Compartment());
  const lspReferencesCompartmentRef = useRef(new Compartment());
  const lspRenameCompartmentRef = useRef(new Compartment());
  const lspSignatureHelpCompartmentRef = useRef(new Compartment());
  const lspDocumentSymbolsCompartmentRef = useRef(new Compartment());
  const lspInlayHintsCompartmentRef = useRef(new Compartment());
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [vimMode, setVimMode] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  const { themeId, resolvedMode } = useTheme();
  const [hasSelection, setHasSelection] = useState(false);
  const selectedTextRef = useRef("");
  const { handleBlur } = useAutoSave();
  const {
    tabSize,
    insertSpaces,
    fontSize,
    fontFamily,
    fontId,
    wordWrap,
    lineNumbers: showLineNumbers,
    stickyLines,
    inlayHints: inlayHintsEnabled,
  } = useSettingsStore((state) => state.editor);
  const experimentalLsp = useSettingsStore((state) => state.experimental.lsp);
  const lspEnabledForLanguage = useSettingsStore(
    (state) => state.lsp.enabled[language ?? ""] ?? true,
  );
  const blameEnabled = useGitStore((state) => state.blameEnabled);
  const blamePath = useGitStore((state) => state.blamePath);
  const blameLines = useGitStore((state) => state.blameLines);
  const editorFontFamily = fontId || fontFamily;
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

  const createExtensions = useEditorExtensions({
    diagnosticsCompartmentRef,
    breakpointCompartmentRef,
    lspCompletionCompartmentRef,
    lspDefinitionCompartmentRef,
    lspHoverCompartmentRef,
    lspReferencesCompartmentRef,
    lspRenameCompartmentRef,
    lspSignatureHelpCompartmentRef,
    lspDocumentSymbolsCompartmentRef,
    lspInlayHintsCompartmentRef,
    filePathRef,
    selectedTextRef,
    setHasSelection,
    showLineNumbers,
    tabSize,
    insertSpaces,
    fontSize,
    editorFontFamily,
    wordWrap,
  });

  useEffect(() => {
    if (activeProvider !== "ollama") {
      void loadKeyStatus(activeProvider);
    }
  }, [activeProvider, loadKeyStatus]);

  useEditorMount({
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
  });

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

  useEditorReconfiguration({
    viewRef,
    themeId,
    resolvedMode,
    fontSize,
    editorFontFamily,
    showLineNumbers,
    fileBreakpoints,
    filePath,
    wordWrap,
    tabSize,
    insertSpaces,
  });

  const shortcuts = useSettingsStore((state) => state.shortcuts);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!viewRef.current?.hasFocus) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault();
          useSettingsStore.getState().setEditorSettings({ fontSize: fontSize + 1 });
          return;
        }
        if (e.key === "-") {
          e.preventDefault();
          useSettingsStore.getState().setEditorSettings({ fontSize: Math.max(8, fontSize - 1) });
          return;
        }
      }

      if (matchShortcut(e, shortcuts["edit.editWithAI"])) {
        e.preventDefault();
        const text = captureActiveSelection();
        if (text) handleEditWithAI();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captureActiveSelection, handleEditWithAI, fontSize, shortcuts]);

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

  useLspEditorWiring({
    viewRef,
    language,
    filePath,
    experimentalLsp,
    lspEnabledForLanguage,
    inlayHintsEnabled,
    tabId,
    lspCompletionCompartmentRef,
    lspDefinitionCompartmentRef,
    lspHoverCompartmentRef,
    lspReferencesCompartmentRef,
    lspRenameCompartmentRef,
    lspSignatureHelpCompartmentRef,
    lspDocumentSymbolsCompartmentRef,
    lspInlayHintsCompartmentRef,
  });

  useEditorSearchEvents({ viewRef, tabId });

  useEditorLanguageSync({
    viewRef,
    fileName,
    canComplete,
    completionDebounce,
    completionTriggerCharacters,
    filePath,
    activeProvider,
    activeModel,
    providerConfig,
  });

  useBlameGutter({
    viewRef,
    blameEnabled,
    blamePath,
    blameLines,
    filePath,
    tabId,
  });

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <StickyLinesOverlay view={editorView} enabled={stickyLines} />
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
    return <EditorEmptyState />;
  }

  if (activeTab.kind === "diff") {
    const isAiEdit = !!activeTab.sourceTabId;
    const isAgentReview = activeTab.agentReviewId !== undefined && !activeTab.agentApplied;

    const handleAccept = (modified: string) => {
      if (activeTab.agentReviewId) {
        useAgentStore.getState().resolveEditReview(activeTab.agentReviewId, true);
        return;
      }
      if (activeTab.sourceTabId) {
        updateFileContent(activeTab.sourceTabId, modified);
      }
      closeTab(activeTab.id);
      useAIEditStore.getState().acceptEdit();
    };

    const handleReject = () => {
      if (activeTab.agentReviewId) {
        useAgentStore.getState().resolveEditReview(activeTab.agentReviewId, false);
        return;
      }
      closeTab(activeTab.id);
      useAIEditStore.getState().rejectEdit();
    };

    const showActions = isAiEdit || isAgentReview;

    return (
      <div className="flex h-full w-full flex-col">
        <div className="relative min-h-0 flex-1">
          <InlineDiff
            original={activeTab.original}
            modified={activeTab.modified}
            patchText={activeTab.patchText}
            filePath={activeTab.path}
            onAccept={showActions ? handleAccept : undefined}
            onReject={showActions ? handleReject : undefined}
          />
        </div>
        <EditorStatusbar vimMode={null} line={0} column={0} fileType={activeTab.path} />
      </div>
    );
  }

  if (activeTab.kind === "references") {
    return <ReferencesView tab={activeTab} />;
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
