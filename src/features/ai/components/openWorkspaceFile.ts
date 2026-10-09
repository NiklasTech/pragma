import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { detectLanguage } from "@/shared/lib/language";
import { useEditorStore } from "@/shared/stores/editor";
import { openNonTextFile } from "@/features/editor/preview/openPreview";

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
    toast.error(String(err));
    return false;
  }
}
