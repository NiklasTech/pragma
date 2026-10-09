import { detectLanguage } from "@/shared/lib/language";
import { isLspSupported } from "@/shared/lib/lsp-servers";
import { useEditorStore, type FileTab } from "@/shared/stores/editor";
import { useSettingsStore } from "@/shared/stores/settings";
import type { LspDocumentSymbolItem } from "@/features/editor/lsp/client";
import { isLspEnabled } from "@/shared/stores/workspaceSettings/effective";

export interface SymbolSearchContext {
  language: string;
  filePath: string;
}

export interface LineRange {
  start: number;
  end: number;
}

function lspContext(tab: FileTab): SymbolSearchContext | null {
  const language = detectLanguage(tab.name);
  const settings = useSettingsStore.getState();
  if (!settings.experimental.lsp || !language || !isLspSupported(language)) return null;
  if (!isLspEnabled(language)) return null;
  return { language, filePath: tab.path };
}

/** Workspace symbols come from a language server, picked by the active file or another open file. */
export function symbolSearchContext(): SymbolSearchContext | null {
  const { tabs, activeTabId } = useEditorStore.getState();
  const fileTabs = tabs.filter((tab): tab is FileTab => tab.kind === "file");
  const active = fileTabs.find((tab) => tab.id === activeTabId);
  const ordered = active ? [active, ...fileTabs.filter((tab) => tab !== active)] : fileTabs;
  for (const tab of ordered) {
    const context = lspContext(tab);
    if (context) return context;
  }
  return null;
}

/** The smallest document symbol with this name that covers the 0-based line, as 0-based lines. */
export function pickSymbolRange(
  symbols: readonly LspDocumentSymbolItem[],
  name: string,
  line: number,
): LineRange | null {
  let best: LineRange | null = null;
  for (const symbol of symbols) {
    if (symbol.name !== name) continue;
    const start = symbol.range.start.line;
    const end = symbol.range.end.line;
    if (start > line || end < line) continue;
    if (!best || end - start < best.end - best.start) best = { start, end };
  }
  return best;
}
