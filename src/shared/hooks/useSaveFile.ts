import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useEditorStore } from "@/shared/stores/editor";

export function useSaveFile() {
  return useCallback(async () => {
    const { tabs, activeTabId, markModified } = useEditorStore.getState();
    const tab = tabs.find((candidate) => candidate.id === activeTabId);
    if (!tab || tab.kind !== "file") return;
    if (!tab.isModified) return;

    try {
      await invoke("write_text_file", {
        path: tab.path,
        content: tab.content,
      });
      markModified(tab.id, false);
      toast.success(`Saved ${tab.name}`);
    } catch (err) {
      toast.error(String(err));
    }
  }, []);
}
