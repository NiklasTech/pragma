import { useEffect, useRef, useCallback } from "react";
import { useSaveFile } from "./useSaveFile";
import { useSettingsStore } from "@/stores/settings";
import { useEditorStore } from "@/stores/editor";

export function useAutoSave() {
  const saveFile = useSaveFile();
  const autoSave = useSettingsStore((state) => state.editor.autoSave);
  const autoSaveDelay = useSettingsStore((state) => state.editor.autoSaveDelay);
  const activeTabId = useEditorStore((state) => state.activeTabId);
  const openFiles = useEditorStore((state) => state.openFiles);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFile = openFiles.find((f) => f.id === activeTabId);

  useEffect(() => {
    if (autoSave !== "afterDelay" || !activeFile || !activeFile.isModified) {
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
  }, [activeFile?.content, activeFile?.isModified, autoSave, autoSaveDelay, saveFile]);

  const handleBlur = useCallback(() => {
    if (autoSave === "onFocusChange" && activeFile?.isModified) {
      void saveFile();
    }
  }, [autoSave, activeFile?.isModified, saveFile]);

  return { handleBlur };
}
