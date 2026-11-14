import { useEffect } from "react";
import { matchShortcut, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { OVERLAY_SHORTCUTS, useOverlayStore } from "@/shared/stores/overlays";

const OVERLAY_ACTIONS = new Set<string>(Object.values(OVERLAY_SHORTCUTS));

export type ShortcutActions = Partial<Record<ShortcutActionId, () => void>>;

export function useGlobalShortcuts(actions: ShortcutActions): void {
  const shortcuts = useSettingsStore((state) => state.shortcuts);
  const isCommandPaletteOpen = useCommandPaletteStore((state) => state.isOpen);
  const activeOverlay = useOverlayStore((state) => state.active);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      for (const [actionId, binding] of Object.entries(shortcuts)) {
        if (!matchShortcut(event, binding)) continue;

        const handler = actions[actionId as ShortcutActionId];
        if (!handler) continue;

        // While a modal palette is open, only allow toggling that same palette closed.
        if (isCommandPaletteOpen && actionId !== "view.commandPalette") continue;
        // While an overlay is open, only overlay shortcuts work: they close it or switch to another.
        if (activeOverlay && !OVERLAY_ACTIONS.has(actionId)) continue;

        event.preventDefault();
        handler();
        break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, actions, isCommandPaletteOpen, activeOverlay]);
}
