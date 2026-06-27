import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type HistoryEntryKind = "git" | "snapshot";

export interface HistoryEntry {
  id: string;
  kind: HistoryEntryKind;
  timestamp: number;
  author: string;
  message: string;
}

export interface DiffResult {
  original: string;
  modified: string;
  patchText: string;
}

interface LocalHistoryState {
  entries: HistoryEntry[];
  selectedEntry: HistoryEntry | null;
  diffResult: DiffResult | null;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  activeFilePath: string | null;
}

interface LocalHistoryActions {
  loadEntries: (filePath: string) => Promise<void>;
  selectEntry: (filePath: string, entry: HistoryEntry) => Promise<void>;
  restoreEntry: (filePath: string, entry: HistoryEntry) => Promise<void>;
  openPanel: (filePath: string) => void;
  closePanel: () => void;
  clear: () => void;
}

export const useLocalHistoryStore = create<LocalHistoryState & LocalHistoryActions>((set) => ({
  entries: [],
  selectedEntry: null,
  diffResult: null,
  isLoading: false,
  error: null,
  isOpen: false,
  activeFilePath: null,

  loadEntries: async (filePath) => {
    set({ isLoading: true, error: null });
    try {
      const response = await invoke<{ entries: HistoryEntry[] }>("local_history_entries", {
        filePath,
        limit: 100,
      });
      set({ entries: response.entries, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  selectEntry: async (filePath, entry) => {
    set({ selectedEntry: entry, isLoading: true, error: null, diffResult: null });
    try {
      const response = await invoke<DiffResult>("local_history_diff", {
        filePath,
        entryId: entry.id,
        kind: entry.kind,
      });
      set({ diffResult: response, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  restoreEntry: async (filePath, entry) => {
    try {
      await invoke("local_history_restore", {
        filePath,
        entryId: entry.id,
        kind: entry.kind,
      });
    } catch (err) {
      set({ error: String(err) });
    }
  },

  openPanel: (filePath) => {
    set({ activeFilePath: filePath, isOpen: true, selectedEntry: null, diffResult: null });
  },

  closePanel: () => {
    set({ isOpen: false, activeFilePath: null, selectedEntry: null, diffResult: null });
  },

  clear: () => {
    set({
      entries: [],
      selectedEntry: null,
      diffResult: null,
      isLoading: false,
      error: null,
    });
  },
}));
