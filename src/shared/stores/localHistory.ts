import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface SnapshotMeta {
  id: string;
  timestamp: string;
  file_path: string;
}

export interface DiffResult {
  original: string;
  modified: string;
}

interface LocalHistoryState {
  snapshots: SnapshotMeta[];
  selectedSnapshotId: string | null;
  diffResult: DiffResult | null;
  isLoading: boolean;
  error: string | null;
}

interface LocalHistoryActions {
  loadSnapshots: (filePath: string) => Promise<void>;
  selectSnapshot: (filePath: string, snapshotId: string) => Promise<void>;
  restoreSnapshot: (filePath: string, snapshotId: string) => Promise<void>;
  clear: () => void;
}

export const useLocalHistoryStore = create<LocalHistoryState & LocalHistoryActions>((set) => ({
  snapshots: [],
  selectedSnapshotId: null,
  diffResult: null,
  isLoading: false,
  error: null,

  loadSnapshots: async (filePath) => {
    set({ isLoading: true, error: null });
    try {
      const response = await invoke<{ snapshots: SnapshotMeta[] }>("local_history_snapshots", {
        filePath,
      });
      set({ snapshots: response.snapshots, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  selectSnapshot: async (filePath, snapshotId) => {
    set({ isLoading: true, error: null, selectedSnapshotId: snapshotId });
    try {
      const response = await invoke<DiffResult>("local_history_diff", {
        filePath,
        snapshotId,
      });
      set({ diffResult: response, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  restoreSnapshot: async (filePath, snapshotId) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("local_history_restore", { filePath, snapshotId });
      set({ isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  clear: () =>
    set({
      snapshots: [],
      selectedSnapshotId: null,
      diffResult: null,
      isLoading: false,
      error: null,
    }),
}));
