import { useCallback, useEffect, useRef, useState } from "react";
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/shared/components/ui/context-menu";
import { useAIEditStore } from "@/shared/stores/aiEdit";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { detectLanguage } from "@/shared/lib/language";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import {
  EDITOR_DEFINITION_AVAILABILITY_EVENT,
  dispatchEditorCheckDefinition,
  dispatchEditorGoToDefinition,
  type EditorDefinitionAvailabilityEventDetail,
} from "@/shared/lib/editor-events";
import { useLayoutStore } from "@/shell/layout";
import {
  acceptTerminalSuggestion,
  dismissTerminalSuggestion,
  TERMINAL_SELECTION_EVENT,
  TERMINAL_SUGGESTION_EVENT,
  type TerminalSelectionEventDetail,
  type TerminalSuggestionEventDetail,
} from "@/shared/lib/terminal-events";
import {
  ArrowSquareOut,
  Broom,
  ClipboardText,
  Copy,
  Lightning,
  Scissors,
  SelectionAll,
  Sparkle,
  X,
} from "@phosphor-icons/react";

type ContextType = "editor" | "terminal" | "input" | "generic";

interface MenuState {
  contextType: ContextType;
  selection: string;
  position: { clientX: number; clientY: number } | null;
}

const MOD_KEY = navigator.platform.toLowerCase().includes("mac") ? "Cmd" : "Ctrl";

function detectContextType(target: EventTarget | null): ContextType {
  const el = target as HTMLElement | null;
  if (!el) return "generic";
  if (el.closest(".cm-editor")) return "editor";
  if (el.closest(".xterm")) return "terminal";
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable) {
    return "input";
  }
  return "generic";
}

function getActiveSelection(): string {
  return window.getSelection()?.toString() ?? "";
}

export function GlobalContextMenu({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null);
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
  const lspEnabledForLanguage = useSettingsStore(
    (state) => state.lsp.enabled[activeLanguage ?? ""] ?? true,
  );
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
      setMenu({
        contextType,
        selection: contextType === "terminal" ? terminalSelection : getActiveSelection(),
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
    setMenu(null);
  }, []);

  const handleGoToDefinition = useCallback(() => {
    if (menu?.position) {
      dispatchEditorGoToDefinition(menu.position);
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
    document.execCommand("selectAll");
    closeMenu();
  }, [closeMenu]);

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

  const handleClearTerminal = useCallback(() => {
    window.dispatchEvent(new CustomEvent("pragma:terminal:clear"));
    closeMenu();
  }, [closeMenu]);

  const handleAcceptTerminalSuggestion = useCallback(() => {
    acceptTerminalSuggestion();
    closeMenu();
  }, [closeMenu]);

  const handleDismissTerminalSuggestion = useCallback(() => {
    dismissTerminalSuggestion();
    closeMenu();
  }, [closeMenu]);

  const contextType = menu?.contextType ?? "generic";
  const showTextActions = contextType === "editor" || contextType === "input";
  const canGoToDefinition = contextType === "editor" && lspReady && definitionAvailable;
  const showTerminalActions = contextType === "terminal";
  const showAskAI = contextType === "editor" && hasSelection;
  const showTerminalSuggestion = contextType === "terminal" && terminalSuggestion.visible;

  return (
    <ContextMenu>
      <ContextMenuPrimitive.Trigger
        render={(props) => (
          <div
            {...props}
            className="contents"
            onContextMenu={(event) => {
              props.onContextMenu?.(event);
              handleContextMenu(event);
            }}
          >
            {children}
          </div>
        )}
      />
      <ContextMenuContent className="w-52">
        {contextType === "editor" && (
          <>
            <ContextMenuItem disabled={!canGoToDefinition} onClick={handleGoToDefinition}>
              <ArrowSquareOut size={14} />
              <span>Go to Definition</span>
              <ContextMenuShortcut>F12</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {showTextActions && (
          <>
            <ContextMenuItem disabled={!hasSelection} onClick={handleCut}>
              <Scissors size={14} />
              <span>Cut</span>
              <ContextMenuShortcut>
                {MOD_KEY}+{"X"}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem disabled={!hasSelection} onClick={handleCopy}>
              <Copy size={14} />
              <span>Copy</span>
              <ContextMenuShortcut>
                {MOD_KEY}+{"C"}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handlePaste}>
              <ClipboardText size={14} />
              <span>Paste</span>
              <ContextMenuShortcut>
                {MOD_KEY}+{"V"}
              </ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleSelectAll}>
              <SelectionAll size={14} />
              <span>Select All</span>
              <ContextMenuShortcut>
                {MOD_KEY}+{"A"}
              </ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
        {showTerminalActions && (
          <>
            <ContextMenuItem disabled={!hasSelection} onClick={handleCopy}>
              <Copy size={14} />
              <span>Copy</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={handlePaste}>
              <ClipboardText size={14} />
              <span>Paste</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleClearTerminal}>
              <Broom size={14} />
              <span>Clear</span>
            </ContextMenuItem>
            {showTerminalSuggestion && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleAcceptTerminalSuggestion}>
                  <Lightning size={14} />
                  <span>Accept Suggestion</span>
                  <ContextMenuShortcut>Tab</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={handleDismissTerminalSuggestion}>
                  <X size={14} />
                  <span>Dismiss Suggestion</span>
                  <ContextMenuShortcut>Esc</ContextMenuShortcut>
                </ContextMenuItem>
              </>
            )}
          </>
        )}
        {showAskAI && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleAskAI}>
              <Sparkle size={14} />
              <span>Ask Pragma</span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
