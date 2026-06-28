import { useEffect, useRef } from "react";
import { useEditorStore, type EditorTab } from "@/shared/stores/editor";
import { useProblemsStore } from "@/shared/stores/problems";

function isFileTab(tab: EditorTab): tab is Extract<EditorTab, { kind: "file" }> {
  return tab.kind === "file";
}

export function useDiagnosticsCleanup() {
  const tabs = useEditorStore((state) => state.tabs);
  const clearFileDiagnostics = useProblemsStore((state) => state.clearFileDiagnostics);
  const previousPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentPaths = new Set(tabs.filter(isFileTab).map((tab) => tab.path));
    const previousPaths = previousPathsRef.current;

    for (const path of previousPaths) {
      if (!currentPaths.has(path)) {
        clearFileDiagnostics(path);
      }
    }

    previousPathsRef.current = currentPaths;
  }, [tabs, clearFileDiagnostics]);
}
