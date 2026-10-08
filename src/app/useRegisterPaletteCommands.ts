import { useEffect } from "react";
import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";

/** Registers the commands while mounted; pass a memoized array. */
export function useRegisterPaletteCommands(commands: CommandPaletteItem[]): void {
  const registerCommand = useCommandPaletteStore((state) => state.registerCommand);
  const unregisterCommand = useCommandPaletteStore((state) => state.unregisterCommand);

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
