import { EditorView, keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { toast } from "sonner";

import { useEditorStore } from "@/shared/stores/editor";
import { lspReferences } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";
import { coordsToPos, positionToLsp } from "./definition";

export async function findReferencesAt(
  view: EditorView,
  language: string,
  filePath: string,
  pos: number,
): Promise<void> {
  const { line, character } = positionToLsp(view.state.doc, pos);
  const word = view.state.wordAt(pos);
  const symbol = word ? view.state.doc.sliceString(word.from, word.to) : "symbol";

  try {
    await flushLspDocumentSync(language, filePath, view.state.doc.toString()).catch(() => {});
    const locations = await lspReferences(language, filePath, line, character);
    if (locations.length === 0) {
      toast.info(`No references found for "${symbol}"`);
      return;
    }
    useEditorStore.getState().openReferences({ path: filePath, symbol, locations });
  } catch (error) {
    console.error("LSP references request failed", error);
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

export function findReferencesAtCoords(
  view: EditorView,
  language: string,
  filePath: string,
  clientX: number,
  clientY: number,
): void {
  const pos = coordsToPos(view, clientX, clientY);
  if (pos === null) {
    return;
  }
  void findReferencesAt(view, language, filePath, pos);
}

export function lspReferencesExtension(language: string, filePath: string): Extension {
  return keymap.of([
    {
      key: "Shift-F12",
      run: (view) => {
        void findReferencesAt(view, language, filePath, view.state.selection.main.head);
        return true;
      },
    },
  ]);
}
