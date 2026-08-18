import { useEffect } from "react";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { debugCurrentFile } from "@/features/debug/debugCurrentFile";

export function useDebugCommands(): void {
  const registerCommand = useCommandPaletteStore((state) => state.registerCommand);
  const unregisterCommand = useCommandPaletteStore((state) => state.unregisterCommand);

  useEffect(() => {
    registerCommand({
      id: "debug.currentFile",
      label: "Debug: Debug Current File",
      category: "debug",
      action: () => {
        void debugCurrentFile();
      },
    });

    return () => {
      unregisterCommand("debug.currentFile");
    };
  }, [registerCommand, unregisterCommand]);
}
