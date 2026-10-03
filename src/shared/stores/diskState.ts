import { create, type StateCreator } from "zustand";
import { crossWindowSync } from "./sync/crossWindowSync";
import { getWindowScope } from "@/shared/lib/windowScope";

/// How an open file differs from disk: changed under unsaved edits, or deleted.
export type DiskStatus = "changed" | "deleted";

interface DiskStateState {
  statuses: Record<string, DiskStatus>;
}

interface DiskStateActions {
  setStatus: (path: string, status: DiskStatus) => void;
  clearStatus: (path: string) => void;
  retainPaths: (paths: Set<string>) => void;
}

const diskStateStoreCreator: StateCreator<DiskStateState & DiskStateActions> = (set, get) => ({
  statuses: {},

  setStatus: (path, status) => {
    const { statuses } = get();
    if (statuses[path] === status) return;
    set({ statuses: { ...statuses, [path]: status } });
  },

  clearStatus: (path) => {
    const { statuses } = get();
    if (!(path in statuses)) return;
    const next = { ...statuses };
    delete next[path];
    set({ statuses: next });
  },

  retainPaths: (paths) => {
    const { statuses } = get();
    const kept = Object.entries(statuses).filter(([path]) => paths.has(path));
    if (kept.length === Object.keys(statuses).length) return;
    set({ statuses: Object.fromEntries(kept) });
  },
});

export const useDiskStateStore = create<DiskStateState & DiskStateActions>()(
  crossWindowSync<DiskStateState & DiskStateActions>(
    "diskState",
    getWindowScope(),
  )(diskStateStoreCreator),
);
