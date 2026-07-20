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
  createEditorFontStyleExtension,
} from "@/shared/lib/theme/editor-theme";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
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
import { insertTabBinding } from "./extensions/tab-keymap";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import { lspServerCapabilities } from "@/features/editor/lsp/client";
import { lspCompletionExtension } from "@/features/editor/lsp/completion";
import {
  goToDefinitionAtCoords,
  hasDefinitionAtCoords,
  lspDefinitionExtension,
} from "@/features/editor/lsp/definition";
import { lspHoverExtension } from "@/features/editor/lsp/hover";
import { lspFormattingExtension, formatDocumentInView } from "@/features/editor/lsp/formatting";
import { lspReferencesExtension, findReferencesAtCoords } from "@/features/editor/lsp/references";
import { lspRenameExtension, requestRenameAtCoords } from "@/features/editor/lsp/rename";
import { requestCodeActionsAtCoords } from "@/features/editor/lsp/codeActions";
import {
  lspDocumentSymbolsExtension,
  openDocumentSymbolsForView,
} from "@/features/editor/lsp/symbols";
import { signatureHelpExtension } from "@/features/editor/lsp/signatureHelp";
import { setLspFeatureFlags } from "@/features/editor/lsp/lspFlags";
import {
  EDITOR_CHECK_DEFINITION_EVENT,
  EDITOR_CODE_ACTION_EVENT,
  EDITOR_DOCUMENT_SYMBOLS_EVENT,
  EDITOR_FIND_REFERENCES_EVENT,
  EDITOR_FORMAT_DOCUMENT_EVENT,
  EDITOR_GO_TO_DEFINITION_EVENT,
  EDITOR_RENAME_EVENT,
  dispatchEditorDefinitionAvailability,
  type EditorCheckDefinitionEventDetail,
  type EditorFindReferencesEventDetail,
  type EditorGoToDefinitionEventDetail,
} from "@/shared/lib/editor-events";
import { EditorStatusbar } from "./EditorStatusbar";
import { ReferencesView } from "./ReferencesView";
import { StickyLinesOverlay } from "./StickyLinesOverlay";
import { InlineDiff } from "./InlineDiff";

const languageCompartment = new Compartment();
const ghostTextCompartment = new Compartment();
const fontStyleCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const wordWrapCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const indentUnitCompartment = new Compartment();
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
  const lspCompletionCompartmentRef = useRef(new Compartment());
  const lspDefinitionCompartmentRef = useRef(new Compartment());
  const lspHoverCompartmentRef = useRef(new Compartment());
  const lspFormattingCompartmentRef = useRef(new Compartment());
  const lspReferencesCompartmentRef = useRef(new Compartment());
  const lspRenameCompartmentRef = useRef(new Compartment());
  const lspSignatureHelpCompartmentRef = useRef(new Compartment());
  const lspDocumentSymbolsCompartmentRef = useRef(new Compartment());
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
  } = useSettingsStore((state) => state.editor);
  const experimentalLsp = useSettingsStore((state) => state.experimental.lsp);
  const lspEnabledForLanguage = useSettingsStore(
    (state) => state.lsp.enabled[language ?? ""] ?? true,
  );
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
        lspCompletionCompartmentRef.current.of([]),
        lspDefinitionCompartmentRef.current.of([]),
        lspHoverCompartmentRef.current.of([]),
        lspFormattingCompartmentRef.current.of([]),
        lspReferencesCompartmentRef.current.of([]),
        lspRenameCompartmentRef.current.of([]),
        lspSignatureHelpCompartmentRef.current.of([]),
        lspDocumentSymbolsCompartmentRef.current.of([]),
        lintGutter(),
        lineNumbersCompartment.of(showLineNumbers ? lineNumbers() : []),
        history(),
        ghostTextCompartment.of(ghostTextExtension(ghostConfig)),
        keymap.of([...defaultKeymap, ...historyKeymap, insertTabBinding]),
        drawSelection(),
        editorBaseTheme,
        fontStyleCompartment.of(createEditorFontStyleExtension(fontSize, editorFontFamily)),
        wordWrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
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
        tabSizeCompartment.of(EditorState.tabSize.of(tabSize)),
        EditorState.allowMultipleSelections.of(true),
        indentUnitCompartment.of(indentUnit.of(insertSpaces ? " ".repeat(tabSize) : "\t")),
      ];

      if (enableVim) {
        extensions.unshift(vim({ status: false }));
      }

      return extensions;
    },
    [tabSize, insertSpaces, fontSize, editorFontFamily, wordWrap, showLineNumbers],
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

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: fontStyleCompartment.reconfigure(
        createEditorFontStyleExtension(fontSize, editorFontFamily),
      ),
    });
  }, [fontSize, editorFontFamily]);

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: lineNumbersCompartment.reconfigure(showLineNumbers ? lineNumbers() : []),
    });
  }, [showLineNumbers]);

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: wordWrapCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
  }, [wordWrap]);

  useEffect(() => {
    if (!viewRef.current) return;

    viewRef.current.dispatch({
      effects: [
        tabSizeCompartment.reconfigure(EditorState.tabSize.of(tabSize)),
        indentUnitCompartment.reconfigure(indentUnit.of(insertSpaces ? " ".repeat(tabSize) : "\t")),
      ],
    });
  }, [tabSize, insertSpaces]);

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

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: [
        lspCompletionCompartmentRef.current.reconfigure([]),
        lspHoverCompartmentRef.current.reconfigure([]),
        lspFormattingCompartmentRef.current.reconfigure([]),
        lspSignatureHelpCompartmentRef.current.reconfigure([]),
      ],
    });

    if (!experimentalLsp || !lspEnabledForLanguage || !language || !isLspSupported(language)) {
      return;
    }

    const resolvedLanguage = language;
    let cancelled = false;

    void lspServerCapabilities(resolvedLanguage, filePath)
      .then((flags) => {
        if (cancelled || !viewRef.current) return;
        setLspFeatureFlags(filePath, flags);
        const extension = flags.completion
          ? lspCompletionExtension(resolvedLanguage, filePath, flags)
          : [];
        const hoverExtension = flags.hover ? lspHoverExtension(resolvedLanguage, filePath) : [];
        const formattingExtension = flags.formatting
          ? lspFormattingExtension(resolvedLanguage, filePath)
          : [];
        const signatureHelp = flags.signatureHelp
          ? signatureHelpExtension(resolvedLanguage, filePath, flags.signatureHelpTriggerCharacters)
          : [];
        viewRef.current.dispatch({
          effects: [
            lspCompletionCompartmentRef.current.reconfigure(extension),
            lspHoverCompartmentRef.current.reconfigure(hoverExtension),
            lspFormattingCompartmentRef.current.reconfigure(formattingExtension),
            lspSignatureHelpCompartmentRef.current.reconfigure(signatureHelp),
          ],
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [language, filePath, experimentalLsp, lspEnabledForLanguage]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const enabled =
      experimentalLsp && lspEnabledForLanguage && language && isLspSupported(language);
    view.dispatch({
      effects: [
        lspDefinitionCompartmentRef.current.reconfigure(
          enabled ? lspDefinitionExtension(language, filePath) : [],
        ),
        lspReferencesCompartmentRef.current.reconfigure(
          enabled ? lspReferencesExtension(language, filePath) : [],
        ),
        lspRenameCompartmentRef.current.reconfigure(
          enabled ? lspRenameExtension(language, filePath) : [],
        ),
        lspDocumentSymbolsCompartmentRef.current.reconfigure(
          enabled ? lspDocumentSymbolsExtension(language, filePath) : [],
        ),
      ],
    });
  }, [language, filePath, experimentalLsp, lspEnabledForLanguage]);

  useEffect(() => {
    if (!language) return;

    const lspActive = () => experimentalLsp && lspEnabledForLanguage && isLspSupported(language);

    const onGoToDefinition = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY } = (event as CustomEvent<EditorGoToDefinitionEventDetail>).detail;
      goToDefinitionAtCoords(view, language, filePath, clientX, clientY);
    };

    const onFindReferences = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY } = (event as CustomEvent<EditorFindReferencesEventDetail>).detail;
      findReferencesAtCoords(view, language, filePath, clientX, clientY);
    };

    const onRename = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY } = (event as CustomEvent<EditorFindReferencesEventDetail>).detail;
      requestRenameAtCoords(view, language, filePath, clientX, clientY);
    };

    const onCodeAction = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY } = (event as CustomEvent<EditorFindReferencesEventDetail>).detail;
      requestCodeActionsAtCoords(view, language, filePath, clientX, clientY);
    };

    const onDocumentSymbols = () => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      if (useEditorStore.getState().activeTabId !== tabId) return;
      void openDocumentSymbolsForView(view, language, filePath);
    };

    const onFormatDocument = () => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      if (useEditorStore.getState().activeTabId !== tabId) return;
      void formatDocumentInView(view, language, filePath);
    };

    const onCheckDefinition = (event: Event) => {
      const view = viewRef.current;
      if (!view || !lspActive()) return;
      const { clientX, clientY, requestId } = (
        event as CustomEvent<EditorCheckDefinitionEventDetail>
      ).detail;
      void hasDefinitionAtCoords(view, language, filePath, clientX, clientY).then((available) => {
        if (available !== null) {
          dispatchEditorDefinitionAvailability({ requestId, available });
        }
      });
    };

    window.addEventListener(EDITOR_GO_TO_DEFINITION_EVENT, onGoToDefinition);
    window.addEventListener(EDITOR_CHECK_DEFINITION_EVENT, onCheckDefinition);
    window.addEventListener(EDITOR_FORMAT_DOCUMENT_EVENT, onFormatDocument);
    window.addEventListener(EDITOR_FIND_REFERENCES_EVENT, onFindReferences);
    window.addEventListener(EDITOR_RENAME_EVENT, onRename);
    window.addEventListener(EDITOR_CODE_ACTION_EVENT, onCodeAction);
    window.addEventListener(EDITOR_DOCUMENT_SYMBOLS_EVENT, onDocumentSymbols);
    return () => {
      window.removeEventListener(EDITOR_GO_TO_DEFINITION_EVENT, onGoToDefinition);
      window.removeEventListener(EDITOR_CHECK_DEFINITION_EVENT, onCheckDefinition);
      window.removeEventListener(EDITOR_FORMAT_DOCUMENT_EVENT, onFormatDocument);
      window.removeEventListener(EDITOR_FIND_REFERENCES_EVENT, onFindReferences);
      window.removeEventListener(EDITOR_RENAME_EVENT, onRename);
      window.removeEventListener(EDITOR_CODE_ACTION_EVENT, onCodeAction);
      window.removeEventListener(EDITOR_DOCUMENT_SYMBOLS_EVENT, onDocumentSymbols);
    };
  }, [language, filePath, experimentalLsp, lspEnabledForLanguage]);

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
