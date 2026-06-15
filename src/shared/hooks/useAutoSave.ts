import { useEffect, useRef, useCallback } from "react";
import { useSaveFile } from "./useSaveFile";
import { useSettingsStore } from "@/shared/stores/settings";
import { useEditorStore } from "@/shared/stores/editor";

export function useAutoSave() {
  const saveFile = useSaveFile();
  const autoSave = useSettingsStore((state) => state.editor.autoSave);
  const autoSaveDelay = useSettingsStore((state) => state.editor.autoSaveDelay);
  const activeTabId = useEditorStore((state) => state.activeTabId);
  const tabs = useEditorStore((state) => state.tabs);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isFileTab = activeTab?.kind === "file";
  const isModified = isFileTab ? activeTab.isModified : false;
  const content = isFileTab ? activeTab.content : "";

  useEffect(() => {
    if (autoSave !== "afterDelay" || !isFileTab || !isModified) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      void saveFile();
      timerRef.current = null;
    }, autoSaveDelay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, isModified, autoSave, autoSaveDelay, saveFile]);

  const handleBlur = useCallback(() => {
    if (autoSave === "onFocusChange" && isModified) {
      void saveFile();
    }
  }, [autoSave, isModified, saveFile]);

  return { handleBlur };
}
