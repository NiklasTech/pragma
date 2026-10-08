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

export interface CommandPalettePickerItem {
  id: string;
  label: string;
  detail?: string;
  keywords?: string[];
}

/** A second step that lets the user choose one item, e.g. a branch or a theme. */
export interface CommandPalettePicker {
  placeholder: string;
  emptyText: string;
  items: CommandPalettePickerItem[];
  initialItemId?: string;
  onSelect: (item: CommandPalettePickerItem) => void;
  onHighlight?: (item: CommandPalettePickerItem) => void;
  onCancel?: () => void;
}

/** A second step that asks the user for a line of text, e.g. a branch name. */
export interface CommandPalettePrompt {
  placeholder: string;
  initialValue?: string;
  allowEmpty?: boolean;
  submitLabel: (value: string) => string;
  onSubmit: (value: string) => void;
}

interface CommandPaletteState {
  commands: CommandPaletteItem[];
  isOpen: boolean;
  picker: CommandPalettePicker | null;
  prompt: CommandPalettePrompt | null;
}

interface CommandPaletteActions {
  registerCommand: (command: CommandPaletteItem) => void;
  unregisterCommand: (id: string) => void;
  open: () => void;
  /** Closes the palette and cancels an open picker. */
  close: () => void;
  /** Closes the palette after the user chose an item, without cancelling. */
  finish: () => void;
  toggle: () => void;
  openPicker: (picker: CommandPalettePicker) => void;
  openPrompt: (prompt: CommandPalettePrompt) => void;
}

const CLOSED = { isOpen: false, picker: null, prompt: null } as const;

const commandPaletteStoreCreator: StateCreator<CommandPaletteState & CommandPaletteActions> = (
  set,
  get,
) => ({
  commands: [],
  isOpen: false,
  picker: null,
  prompt: null,

  registerCommand: (command) =>
    set((state) => {
      const filtered = state.commands.filter((c) => c.id !== command.id);
      return { commands: [...filtered, command] };
    }),

  unregisterCommand: (id) =>
    set((state) => ({
      commands: state.commands.filter((c) => c.id !== id),
    })),

  open: () => set({ isOpen: true, picker: null, prompt: null }),
  close: () => {
    const { picker } = get();
    set(CLOSED);
    picker?.onCancel?.();
  },
  finish: () => set(CLOSED),
  toggle: () => {
    if (get().isOpen) get().close();
    else get().open();
  },
  openPicker: (picker) => set({ isOpen: true, picker, prompt: null }),
  openPrompt: (prompt) => set({ isOpen: true, picker: null, prompt }),
});

export const useCommandPaletteStore = create<CommandPaletteState & CommandPaletteActions>()(
  commandPaletteStoreCreator,
);
