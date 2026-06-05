import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editor";

export function useSaveFile() {
  const { openFiles, activeTabId, markModified } = useEditorStore();

  return useCallback(async () => {
    const file = openFiles.find((f) => f.id === activeTabId);
    if (!file) return;
    if (!file.isModified) return;

    try {
      await invoke("write_text_file", {
        path: file.path,
        content: file.content,
      });
      markModified(file.id, false);
      toast.success(`Saved ${file.name}`);
    } catch (err) {
      toast.error(String(err));
    }
  }, [openFiles, activeTabId, markModified]);
}
