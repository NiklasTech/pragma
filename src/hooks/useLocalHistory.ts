import { useCallback, useState } from "react";

export function useLocalHistory() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  const openPanel = useCallback((filePath: string) => {
    setActiveFilePath(filePath);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setActiveFilePath(null);
  }, []);

  return {
    isOpen,
    activeFilePath,
    openPanel,
    closePanel,
  };
}
