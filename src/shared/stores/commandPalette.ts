import { create, type StateCreator } from "zustand";
import type { ShortcutActionId } from "@/shared/lib/shortcuts";

export type CommandPaletteCategory = string;

export interface CommandPaletteItem {
  id: string;
  label: string;
  category: CommandPaletteCategory;
  keywords?: string[];
  shortcut?: ShortcutActionId;
  action: () => void;
}

interface CommandPaletteState {
  commands: CommandPaletteItem[];
  isOpen: boolean;
}

interface CommandPaletteActions {
  registerCommand: (command: CommandPaletteItem) => void;
  unregisterCommand: (id: string) => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const commandPaletteStoreCreator: StateCreator<CommandPaletteState & CommandPaletteActions> = (
  set,
) => ({
  commands: [],
  isOpen: false,

  registerCommand: (command) =>
    set((state) => {
      const filtered = state.commands.filter((c) => c.id !== command.id);
      return { commands: [...filtered, command] };
    }),

  unregisterCommand: (id) =>
    set((state) => ({
      commands: state.commands.filter((c) => c.id !== id),
    })),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
});

export const useCommandPaletteStore = create<CommandPaletteState & CommandPaletteActions>()(
  commandPaletteStoreCreator,
);
