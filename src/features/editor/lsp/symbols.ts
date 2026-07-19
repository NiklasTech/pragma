import type { EditorView } from "@codemirror/view";
import { keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { toast } from "sonner";
import { create } from "zustand";

import {
  lspDocumentSymbol,
  lspWorkspaceSymbol,
  type LspDocumentSymbolItem,
  type LspWorkspaceSymbolItem,
} from "./client";
import { flushLspDocumentSync } from "./lspDocuments";

const SYMBOL_KIND_NAMES: Record<number, string> = {
  1: "file",
  2: "module",
  3: "namespace",
  4: "package",
  5: "class",
  6: "method",
  7: "property",
  8: "field",
  9: "constructor",
  10: "enum",
  11: "interface",
  12: "function",
  13: "variable",
  14: "constant",
  23: "struct",
  26: "type parameter",
};

export function symbolKindName(kind: number): string {
  return SYMBOL_KIND_NAMES[kind] ?? "symbol";
}

interface SymbolDialogState {
  mode: "document" | "workspace" | null;
  language: string;
  filePath: string;
  documentItems: LspDocumentSymbolItem[];
  openDocument: (language: string, filePath: string, items: LspDocumentSymbolItem[]) => void;
  openWorkspace: (language: string, filePath: string) => void;
  close: () => void;
}

export const useSymbolDialogStore = create<SymbolDialogState>()((set) => ({
  mode: null,
  language: "",
  filePath: "",
  documentItems: [],
  openDocument: (language, filePath, items) =>
    set({ mode: "document", language, filePath, documentItems: items }),
  openWorkspace: (language, filePath) => set({ mode: "workspace", language, filePath }),
  close: () => set({ mode: null }),
}));

export async function openDocumentSymbolsForView(
  view: EditorView,
  language: string,
  filePath: string,
): Promise<void> {
  try {
    await flushLspDocumentSync(language, filePath, view.state.doc.toString()).catch(() => {});
    const items = await lspDocumentSymbol(language, filePath);
    if (items.length === 0) {
      toast.info("No symbols in this file");
      return;
    }
    useSymbolDialogStore.getState().openDocument(language, filePath, items);
  } catch (error) {
    console.error("LSP document symbol request failed", error);
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

export async function queryWorkspaceSymbols(
  language: string,
  filePath: string,
  query: string,
): Promise<LspWorkspaceSymbolItem[]> {
  try {
    return await lspWorkspaceSymbol(language, filePath, query);
  } catch {
    return [];
  }
}

export function lspDocumentSymbolsExtension(language: string, filePath: string): Extension {
  return keymap.of([
    {
      key: "Ctrl-Shift-o",
      run: (view) => {
        void openDocumentSymbolsForView(view, language, filePath);
        return true;
      },
    },
  ]);
}
