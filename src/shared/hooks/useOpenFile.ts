import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useEditorStore } from "@/shared/stores/editor";
import { useEditorPanelId } from "@/shared/hooks/useEditorPanelId";
import { detectLanguage } from "@/shared/lib/language";

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

export function useOpenFile() {
  const { openFile } = useEditorStore();
  const editorPanelId = useEditorPanelId();

  return useCallback(async () => {
    let path: string | null = null;
    try {
      path = await open({
        multiple: false,
        directory: false,
      });
    } catch (err) {
      toast.error(`Failed to open dialog: ${String(err)}`);
      return;
    }

    if (typeof path !== "string" || path.length === 0) {
      return;
    }

    try {
      const result = await invoke<FileReadResult>("read_text_file", { path });
      openFile(
        {
          id: result.path,
          path: result.path,
          name: result.name,
          content: result.content,
          isModified: false,
          language: detectLanguage(result.name),
        },
        editorPanelId,
      );
    } catch (err) {
      toast.error(String(err));
    }
  }, [openFile, editorPanelId]);
}
