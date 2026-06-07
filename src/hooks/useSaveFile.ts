import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { useEditorStore } from "@/stores/editor";

export function useSaveFile() {
  const { tabs, activeTabId, markModified } = useEditorStore();

  return useCallback(async () => {
    const tab = tabs.find((t) => t.id === activeTabId);
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
  }, [tabs, activeTabId, markModified]);
}
