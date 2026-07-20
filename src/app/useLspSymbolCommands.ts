import { useEffect } from "react";

import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { useEditorStore } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import { detectLanguage } from "@/shared/lib/language";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import { dispatchEditorDocumentSymbols } from "@/shared/lib/editor-events";
import { useSymbolDialogStore } from "@/features/editor/lsp/symbols";

function activeLspContext(): { language: string; filePath: string } | null {
  const { tabs, activeTabId } = useEditorStore.getState();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  if (!activeTab || activeTab.kind !== "file") {
    return null;
  }
  const language = detectLanguage(activeTab.name);
  const settings = useSettingsStore.getState();
  if (!settings.experimental.lsp || !language || !isLspSupported(language)) {
    return null;
  }
  if (!(settings.lsp.enabled[language] ?? true)) {
    return null;
  }
  return { language, filePath: activeTab.path };
}

export function useLspSymbolCommands(): void {
  const registerCommand = useCommandPaletteStore((state) => state.registerCommand);
  const unregisterCommand = useCommandPaletteStore((state) => state.unregisterCommand);

  useEffect(() => {
    registerCommand({
      id: "lsp.documentSymbols",
      label: "Go to Symbol in Editor...",
      category: "search",
      action: () => {
        if (activeLspContext()) {
          dispatchEditorDocumentSymbols();
        }
      },
    });
    registerCommand({
      id: "lsp.workspaceSymbols",
      label: "Go to Symbol in Workspace...",
      category: "search",
      action: () => {
        const context = activeLspContext();
        if (context) {
          useSymbolDialogStore.getState().openWorkspace(context.language, context.filePath);
        }
      },
    });

    return () => {
      unregisterCommand("lsp.documentSymbols");
      unregisterCommand("lsp.workspaceSymbols");
    };
  }, [registerCommand, unregisterCommand]);
}
