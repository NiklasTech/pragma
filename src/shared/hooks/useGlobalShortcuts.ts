import { useEffect } from "react";
import { matchShortcut, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { useSettingsStore } from "@/shared/stores/settings";

export type ShortcutActions = Partial<Record<ShortcutActionId, () => void>>;

export function useGlobalShortcuts(actions: ShortcutActions): void {
  const shortcuts = useSettingsStore((state) => state.shortcuts);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      for (const [actionId, binding] of Object.entries(shortcuts)) {
        if (!matchShortcut(event, binding)) continue;

        const handler = actions[actionId as ShortcutActionId];
        if (!handler) continue;

        event.preventDefault();
        handler();
        break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, actions]);
}
