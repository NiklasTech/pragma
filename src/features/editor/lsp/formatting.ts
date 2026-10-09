import type { EditorView } from "@codemirror/view";
import { toast } from "sonner";

import { lspFormatDocument } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";
import { lspTextEditsToChangeSpec } from "./edits";
import { getEditorSettings } from "@/shared/stores/workspaceSettings/effective";

export async function formatDocumentInView(
  view: EditorView,
  language: string,
  filePath: string,
): Promise<void> {
  const { tabSize, insertSpaces } = getEditorSettings();
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
