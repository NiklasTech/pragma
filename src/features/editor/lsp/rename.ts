import { EditorView, keymap } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { toast } from "sonner";
import { create } from "zustand";

import { useEditorStore } from "@/shared/stores/editor";
import { lspRename } from "./client";
import { flushLspDocumentSync } from "./lspDocuments";
import { coordsToPos, positionToLsp } from "./definition";
import { applyWorkspaceEdits } from "./workspaceEdits";

export interface RenameRequest {
  language: string;
  filePath: string;
  line: number;
  character: number;
  currentName: string;
}

interface RenameDialogState {
  request: RenameRequest | null;
  openDialog: (request: RenameRequest) => void;
  closeDialog: () => void;
}

export const useRenameDialogStore = create<RenameDialogState>()((set) => ({
  request: null,
  openDialog: (request) => set({ request }),
  closeDialog: () => set({ request: null }),
}));

export function requestRenameAt(
  view: EditorView,
  language: string,
  filePath: string,
  pos: number,
): void {
  const word = view.state.wordAt(pos);
  if (!word) {
    toast.info("Place the cursor on a symbol to rename it");
    return;
  }
  const currentName = view.state.doc.sliceString(word.from, word.to);
  const { line, character } = positionToLsp(view.state.doc, pos);
  useRenameDialogStore.getState().openDialog({ language, filePath, line, character, currentName });
}

export function requestRenameAtCoords(
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
  requestRenameAt(view, language, filePath, pos);
}

export async function executeRename(request: RenameRequest, newName: string): Promise<boolean> {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === request.currentName) {
    return false;
  }

  const openTab = useEditorStore
    .getState()
    .tabs.find((t) => t.kind === "file" && t.path === request.filePath);
  const content = openTab?.kind === "file" ? openTab.content : undefined;

  try {
    if (content !== undefined) {
      await flushLspDocumentSync(request.language, request.filePath, content).catch(() => {});
    }
    const edits = await lspRename(
      request.language,
      request.filePath,
      request.line,
      request.character,
      trimmed,
    );
    if (edits.length === 0) {
      toast.info(`"${request.currentName}" cannot be renamed here`);
      return false;
    }
    await applyWorkspaceEdits(edits);
    const total = edits.reduce((count, file) => count + file.edits.length, 0);
    toast.success(`Renamed to "${trimmed}" (${total} edits in ${edits.length} files)`);
    return true;
  } catch (error) {
    console.error("LSP rename request failed", error);
    toast.error(error instanceof Error ? error.message : String(error));
    return false;
  }
}

export function lspRenameExtension(language: string, filePath: string): Extension {
  return keymap.of([
    {
      key: "F2",
      run: (view) => {
        requestRenameAt(view, language, filePath, view.state.selection.main.head);
        return true;
      },
    },
  ]);
}
