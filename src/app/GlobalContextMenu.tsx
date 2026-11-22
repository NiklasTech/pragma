import { useCallback, useEffect, useRef, useState } from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import { ContextMenu } from "@/shared/components/ui/context-menu";
import { ActionMenuPopup } from "@/shared/components/ui/action-menu";
import { useComposerInsertStore } from "@/features/ai/mentions/composerInsert";
import { formatShortcut, getIsMac, type ShortcutBinding } from "@/shared/lib/shortcuts";
import { buildMenu, quoteMarkdown, type MenuContextType } from "./globalMenuSpec";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { detectLanguage } from "@/shared/lib/language";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import { getLspFeatureFlags } from "@/features/editor/lsp/lspFlags";
import {
  EDITOR_DEFINITION_AVAILABILITY_EVENT,
  dispatchEditorCheckDefinition,
  dispatchEditorCodeAction,
  dispatchEditorFindReferences,
  dispatchEditorFormatDocument,
  dispatchEditorGoToDefinition,
  dispatchEditorRename,
  type EditorDefinitionAvailabilityEventDetail,
} from "@/shared/lib/editor-events";
import { useLayoutStore } from "@/shell/layout";
import { selectAllWithin } from "@/shared/lib/textSelection";
import {
  acceptTerminalSuggestion,
  dismissTerminalSuggestion,
  dispatchTerminalClear,
  dispatchTerminalCopyOutput,
  dispatchTerminalFind,
  terminalSessionAt,
  TERMINAL_SELECTION_EVENT,
  TERMINAL_SUGGESTION_EVENT,
  type TerminalSelectionEventDetail,
  type TerminalSuggestionEventDetail,
} from "@/shared/lib/terminal-events";
import { useLspEnabled } from "@/shared/stores/workspaceSettings/effective";

interface MenuState {
  contextType: MenuContextType;
  selection: string;
  target: EventTarget | null;
  position: { clientX: number; clientY: number } | null;
}

function getActiveSelection(): string {
  return window.getSelection()?.toString() ?? "";
}

/** Which menu a right-click opens; null keeps the webview's own menu away and opens nothing. */
function detectContextType(target: EventTarget | null): MenuContextType | null {
  if (!(target instanceof Element)) return null;
  if (target.closest(".cm-editor")) return "editor";
  if (target.closest(".xterm")) return "terminal";
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return "input";
  }
  return getActiveSelection().trim() ? "selection" : null;
}

/** A menu of its own already took the click; otherwise only known places open one. */
function wantsMenu(event: React.MouseEvent): boolean {
  return !event.defaultPrevented && detectContextType(event.target) !== null;
}

function shortcutLabel(binding: ShortcutBinding | null | undefined): string | undefined {
  return binding ? formatShortcut(binding, getIsMac()) : undefined;
}

export function GlobalContextMenu({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [open, setOpen] = useState(false);
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const [terminalSelection, setTerminalSelection] = useState("");
  const [terminalSuggestion, setTerminalSuggestion] = useState<TerminalSuggestionEventDetail>({
    suggestion: "",
    visible: false,
  });
  const activeTabId = useEditorStore((state) => state.activeTabId);
  const tabs = useEditorStore((state) => state.tabs);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
  const experimentalLsp = useSettingsStore((state) => state.experimental.lsp);
  const activeLanguage = activeTab?.kind === "file" ? detectLanguage(activeTab.name) : undefined;
  const lspEnabledForLanguage = useLspEnabled(activeLanguage);
  const [definitionAvailable, setDefinitionAvailable] = useState(true);
  const checkSeqRef = useRef(0);

  const lspReady = Boolean(
    experimentalLsp && lspEnabledForLanguage && activeLanguage && isLspSupported(activeLanguage),
  );

  useEffect(() => {
    const onAvailability = (event: Event) => {
      const detail = (event as CustomEvent<EditorDefinitionAvailabilityEventDetail>).detail;
      if (detail.requestId === checkSeqRef.current) {
        setDefinitionAvailable(detail.available);
      }
    };
    window.addEventListener(EDITOR_DEFINITION_AVAILABILITY_EVENT, onAvailability);
    return () => window.removeEventListener(EDITOR_DEFINITION_AVAILABILITY_EVENT, onAvailability);
  }, []);

  useEffect(() => {
    const onSelection = (event: Event) => {
      const detail = (event as CustomEvent<TerminalSelectionEventDetail>).detail;
      setTerminalSelection(detail.selection);
    };
    const onSuggestion = (event: Event) => {
      const detail = (event as CustomEvent<TerminalSuggestionEventDetail>).detail;
      setTerminalSuggestion(detail);
    };

    window.addEventListener(TERMINAL_SELECTION_EVENT, onSelection);
    window.addEventListener(TERMINAL_SUGGESTION_EVENT, onSuggestion);

    return () => {
      window.removeEventListener(TERMINAL_SELECTION_EVENT, onSelection);
      window.removeEventListener(TERMINAL_SUGGESTION_EVENT, onSuggestion);
    };
  }, []);

  const hasSelection = Boolean(menu?.selection.trim());

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const contextType = detectContextType(event.target);
      if (!contextType) return;
      setOpen(true);
      setMenu({
        contextType,
        selection: contextType === "terminal" ? terminalSelection : getActiveSelection(),
        target: event.target,
        position:
          contextType === "editor" ? { clientX: event.clientX, clientY: event.clientY } : null,
      });
      if (contextType === "editor" && lspReady) {
        setDefinitionAvailable(true);
        dispatchEditorCheckDefinition({
          clientX: event.clientX,
          clientY: event.clientY,
          requestId: ++checkSeqRef.current,
        });
      }
    },
    [terminalSelection, lspReady],
  );

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const handleQuote = useCallback(() => {
    if (!menu || !hasSelection) return;
    useComposerInsertStore.getState().insert(quoteMarkdown(menu.selection));
    closeMenu();
  }, [menu, hasSelection, closeMenu]);

  const handleGoToDefinition = useCallback(() => {
    if (menu?.position) {
      dispatchEditorGoToDefinition(menu.position);
    }
    closeMenu();
  }, [menu, closeMenu]);

  const handleFormatDocument = useCallback(() => {
    dispatchEditorFormatDocument();
    closeMenu();
  }, [closeMenu]);

  const handleFindReferences = useCallback(() => {
    if (menu?.position) {
      dispatchEditorFindReferences(menu.position);
    }
    closeMenu();
  }, [menu, closeMenu]);

  const handleRename = useCallback(() => {
    if (menu?.position) {
      dispatchEditorRename(menu.position);
    }
    closeMenu();
  }, [menu, closeMenu]);

  const handleQuickFix = useCallback(() => {
    if (menu?.position) {
      dispatchEditorCodeAction(menu.position);
    }
    closeMenu();
  }, [menu, closeMenu]);

  const handleCopy = useCallback(async () => {
    if (!hasSelection || !menu) return;
    try {
      await navigator.clipboard.writeText(menu.selection);
    } catch {
      // ignore
    }
    closeMenu();
  }, [hasSelection, menu, closeMenu]);

  const handleCut = useCallback(() => {
    if (!hasSelection) return;
    document.execCommand("cut");
    closeMenu();
  }, [hasSelection, closeMenu]);

  const handlePaste = useCallback(() => {
    document.execCommand("paste");
    closeMenu();
  }, [closeMenu]);

  const handleSelectAll = useCallback(() => {
    selectAllWithin(menu?.target ?? null);
    closeMenu();
  }, [menu, closeMenu]);

  const handleAskAI = useCallback(() => {
    if (!menu || !hasSelection) return;
    if (!activeTab || activeTab.kind !== "file") return;

    const language = detectLanguage(activeTab.name);
    useAIEditStore.getState().startEdit({
      originalCode: menu.selection,
      filePath: activeTab.path,
      fileTabId: activeTab.id,
      language,
    });
    useLayoutStore.getState().setAIMode("drawer-right");
    closeMenu();
  }, [activeTab, hasSelection, menu, closeMenu]);

  const menuTerminal = menu ? terminalSessionAt(menu.target) : null;

  const handleClearTerminal = useCallback(() => {
    if (menuTerminal) dispatchTerminalClear(menuTerminal);
    closeMenu();
  }, [closeMenu, menuTerminal]);

  const handleFindInTerminal = useCallback(() => {
    if (menuTerminal) dispatchTerminalFind(menuTerminal);
    closeMenu();
  }, [closeMenu, menuTerminal]);

  const handleCopyTerminalOutput = useCallback(() => {
    if (menuTerminal) dispatchTerminalCopyOutput(menuTerminal);
    closeMenu();
  }, [closeMenu, menuTerminal]);

  const handleAcceptTerminalSuggestion = useCallback(() => {
    acceptTerminalSuggestion();
    closeMenu();
  }, [closeMenu]);

  const handleDismissTerminalSuggestion = useCallback(() => {
    dismissTerminalSuggestion();
    closeMenu();
  }, [closeMenu]);

  const contextType = menu?.contextType ?? "generic";
  const canGoToDefinition = contextType === "editor" && lspReady && definitionAvailable;
  const activeFilePath = activeTab?.kind === "file" ? activeTab.path : undefined;
  const activeFlags = activeFilePath ? getLspFeatureFlags(activeFilePath) : undefined;
  const canFormatDocument = Boolean(
    contextType === "editor" && lspReady && activeFilePath && (activeFlags?.formatting ?? true),
  );
  const canFindReferences = Boolean(
    contextType === "editor" && lspReady && (activeFlags?.references ?? true),
  );
  const canRename = Boolean(contextType === "editor" && lspReady && (activeFlags?.rename ?? true));
  const canQuickFix = Boolean(
    contextType === "editor" && lspReady && (activeFlags?.codeAction ?? true),
  );

  const spec = menu
    ? buildMenu({
        menu,
        hasSelection,
        inChat: menu.target instanceof Element && menu.target.closest("[data-chat-panel]") !== null,
        activeTabName: activeTab?.name ?? null,
        editWithAIShortcut: shortcutLabel(shortcuts["edit.editWithAI"]),
        formatShortcut: shortcutLabel(shortcuts["editor.formatDocument"]),
        lsp: { canGoToDefinition, canFindReferences, canRename, canQuickFix, canFormatDocument },
        terminalSuggestion: terminalSuggestion.visible,
        editorTerminal: menuTerminal !== null,
        actions: {
          editWithAI: handleAskAI,
          goToDefinition: handleGoToDefinition,
          findReferences: handleFindReferences,
          rename: handleRename,
          quickFix: handleQuickFix,
          formatDocument: handleFormatDocument,
          cut: handleCut,
          copy: () => void handleCopy(),
          paste: handlePaste,
          selectAll: handleSelectAll,
          quote: handleQuote,
          clearTerminal: handleClearTerminal,
          findInTerminal: handleFindInTerminal,
          copyTerminalOutput: handleCopyTerminalOutput,
          acceptSuggestion: handleAcceptTerminalSuggestion,
          dismissSuggestion: handleDismissTerminalSuggestion,
        },
      })
    : null;

  return (
    <ContextMenu
      open={open && spec !== null}
      onOpenChange={(next) => {
        // Only a right-click on a known place opens it; see handleContextMenu.
        if (!next) setOpen(false);
      }}
    >
      <ContextMenuPrimitive.Trigger
        render={(props) => (
          <div
            {...props}
            className="contents"
            onContextMenu={(event) => {
              if (!wantsMenu(event)) {
                event.preventDefault();
                return;
              }
              props.onContextMenu?.(event);
              handleContextMenu(event);
            }}
          >
            {children}
          </div>
        )}
      />
      {spec && <ActionMenuPopup spec={spec} onClose={closeMenu} />}
    </ContextMenu>
  );
}
