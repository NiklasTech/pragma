import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { detectLanguage } from "@/shared/lib/language";
import { useEditorStore } from "@/shared/stores/editor";
import { openNonTextFile } from "@/features/editor/preview/openPreview";
import { errorText } from "@/shared/lib/errorText";
import { useUiModeStore } from "@/shell/mode";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
  encoding: string;
}

/// Reads a file from disk and opens it in the editor, like the file explorer does.
export async function openWorkspaceFile(path: string, panelId: string | null): Promise<boolean> {
  if (openNonTextFile(path, panelId)) return true;
  try {
    const result = await invoke<FileReadResult>("read_text_file", { path });
    useEditorStore.getState().openFile(
      {
        id: result.path,
        path: result.path,
        name: result.name,
        content: result.content,
        originalContent: result.content,
        isModified: false,
        language: detectLanguage(result.name),
        encoding: result.encoding,
      },
      panelId,
    );
    return true;
  } catch (err) {
    if (openNonTextFile(path, panelId, err)) return true;
    toast.error(errorText(err));
    return false;
  }
}

/// Opens a file in the editor view, in the editor panel used last, at a line when one is given.
export async function openFileAtLine(path: string, line: number | null): Promise<void> {
  if (!(await openWorkspaceFile(path, useEditorStore.getState().lastFocusedPanelId))) return;
  useUiModeStore.getState().setUiMode("editor");
  const editor = useEditorStore.getState();
  if (line !== null && editor.activeTabId) {
    editor.goToPosition(editor.activeTabId, { line, column: 1 });
  }
}
