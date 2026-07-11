import { useEffect, useMemo } from "react";
import { SHORTCUT_ACTIONS, type ShortcutActionId } from "@/shared/lib/shortcuts";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useAppShortcutActions } from "./useAppShortcutActions";

const COMMAND_PALETTE_ACTION_ID = "view.commandPalette";

export function useCommandPaletteCommands(): void {
  const actions = useAppShortcutActions();
  const { registerCommand, unregisterCommand } = useCommandPaletteStore();

  const commands = useMemo<CommandPaletteItem[]>(() => {
    const actionMap = new Map(SHORTCUT_ACTIONS.map((action) => [action.id, action]));
    const items: CommandPaletteItem[] = [];

    for (const [id, action] of Object.entries(actions)) {
      if (id === COMMAND_PALETTE_ACTION_ID) continue;

      const shortcutAction = actionMap.get(id as ShortcutActionId);
      if (!shortcutAction) continue;

      items.push({
        id,
        label: shortcutAction.label,
        category: shortcutAction.category,
        shortcut: id as ShortcutActionId,
        action,
      });
    }

    return items;
  }, [actions]);

  useEffect(() => {
    for (const command of commands) {
      registerCommand(command);
    }

    return () => {
      for (const command of commands) {
        unregisterCommand(command.id);
      }
    };
  }, [commands, registerCommand, unregisterCommand]);
}
