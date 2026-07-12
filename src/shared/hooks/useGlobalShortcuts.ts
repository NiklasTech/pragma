import { useEffect } from "react";
import { matchShortcut, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { useGoToFileStore } from "@/shared/stores/goToFile";

export type ShortcutActions = Partial<Record<ShortcutActionId, () => void>>;

export function useGlobalShortcuts(actions: ShortcutActions): void {
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const isCommandPaletteOpen = useCommandPaletteStore((state) => state.isOpen);
  const isGoToFileOpen = useGoToFileStore((state) => state.isOpen);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      for (const [actionId, binding] of Object.entries(shortcuts)) {
        if (!matchShortcut(event, binding)) continue;

        const handler = actions[actionId as ShortcutActionId];
        if (!handler) continue;

        // While a modal palette is open, only allow toggling that same palette closed.
        if (isCommandPaletteOpen && actionId !== "view.commandPalette") continue;
        if (isGoToFileOpen && actionId !== "file.goToFile") continue;

        event.preventDefault();
        handler();
        break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, actions, isCommandPaletteOpen, isGoToFileOpen]);
}
