import { useEffect, useMemo } from "react";

import { getIsMac, isConflict, matchShortcut, type ShortcutBinding } from "@/shared/lib/shortcuts";
import { useCommandPaletteStore } from "@/shared/stores/commandPalette";
import { useSettingsStore } from "@/shared/stores/settings";

import { sendExtensionCommand } from "./host";
import { parseKeybinding } from "./keybindingParse";
import { useExtensionsStore } from "./store";

interface ActiveKeybinding {
  extensionId: string;
  command: string;
  binding: ShortcutBinding;
}

/// Runs extension commands from their keybindings; Pragma's own shortcuts always win.
export function useExtensionKeybindings(): void {
  const keybindings = useExtensionsStore((state) => state.keybindings);
  const shortcuts = useSettingsStore((state) => state.shortcuts);

  const active = useMemo<ActiveKeybinding[]>(() => {
    const isMac = getIsMac();
    const builtIn = Object.values(shortcuts);
    return keybindings.flatMap((entry) => {
      const binding = parseKeybinding(isMac && entry.mac ? entry.mac : entry.key, isMac);
      if (!binding || builtIn.some((other) => isConflict(binding, other))) return [];
      return [{ extensionId: entry.extensionId, command: entry.command, binding }];
    });
  }, [keybindings, shortcuts]);

  useEffect(() => {
    if (active.length === 0) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || useCommandPaletteStore.getState().isOpen) return;
      const match = active.find((entry) => matchShortcut(event, entry.binding));
      if (!match) return;
      event.preventDefault();
      sendExtensionCommand(match.extensionId, match.command);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);
}
