import { keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { toast } from "sonner";

import { useSettingsStore } from "@/shared/stores/settings";
import { lspFormatDocument } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";
import { lspTextEditsToChangeSpec } from "./edits";

export async function formatDocumentInView(
  view: EditorView,
  language: string,
  filePath: string,
): Promise<void> {
  const { tabSize, insertSpaces } = useSettingsStore.getState().editor;
  try {
    await flushLspDocumentSync(language, filePath, view.state.doc.toString()).catch(() => {});
    const edits = await lspFormatDocument(language, filePath, tabSize, insertSpaces);
    if (edits.length === 0) {
      return;
    }
    view.dispatch({
      changes: lspTextEditsToChangeSpec(view.state.doc, edits),
      userEvent: "input.format",
    });
  } catch (error) {
    console.error("LSP format request failed", error);
    toast.error(error instanceof Error ? error.message : String(error));
  }
}

export function lspFormattingExtension(language: string, filePath: string): Extension {
  return keymap.of([
    {
      key: "Shift-Alt-f",
      run: (view) => {
        void formatDocumentInView(view, language, filePath);
        return true;
      },
    },
  ]);
}
