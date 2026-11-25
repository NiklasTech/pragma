import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useEditorStore } from "@/shared/stores/editor";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { detectLanguage } from "@/shared/lib/language";
import { openNonTextFile } from "@/features/editor/preview/openPreview";
import { errorText } from "@/shared/lib/errorText";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
  encoding: string;
}

export function useOpenFile() {
  const openFile = useEditorStore((s) => s.openFile);
  const editorPanelId = useEditorPanelId();

  return useCallback(async () => {
    let path: string | null = null;
    try {
      path = await open({
        multiple: false,
        directory: false,
      });
    } catch (err) {
      toast.error(`Failed to open dialog: ${errorText(err)}`);
      return;
    }

    if (typeof path !== "string" || path.length === 0) {
      return;
    }

    if (openNonTextFile(path, editorPanelId)) return;

    try {
      const result = await invoke<FileReadResult>("read_text_file", { path });
      openFile(
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
        editorPanelId,
      );
    } catch (err) {
      if (openNonTextFile(path, editorPanelId, err)) return;
      toast.error(errorText(err));
    }
  }, [openFile, editorPanelId]);
}
