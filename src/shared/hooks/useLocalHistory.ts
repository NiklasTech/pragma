import { useCallback } from "react";
import { useLocalHistoryStore } from "@/shared/stores/localHistory";

export function useLocalHistory() {
  const isOpen = useLocalHistoryStore((state) => state.isOpen);
  const activeFilePath = useLocalHistoryStore((state) => state.activeFilePath);

  const openPanel = useCallback((filePath: string) => {
    useLocalHistoryStore.getState().openPanel(filePath);
  }, []);

  const closePanel = useCallback(() => {
    useLocalHistoryStore.getState().closePanel();
  }, []);

  return {
    isOpen,
    activeFilePath,
    openPanel,
    closePanel,
  };
}
