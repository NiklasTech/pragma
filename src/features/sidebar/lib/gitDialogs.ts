import { create } from "zustand";

interface CompareDialogState {
  open: boolean;
  base: string;
  head: string;
  show: (base: string, head: string) => void;
  close: () => void;
}

export const useGitCompareDialog = create<CompareDialogState>()((set) => ({
  open: false,
  base: "",
  head: "",
  show: (base, head) => set({ open: true, base, head }),
  close: () => set({ open: false }),
}));

interface FileHistoryDialogState {
  path: string | null;
  show: (path: string) => void;
  close: () => void;
}

export const useFileHistoryDialog = create<FileHistoryDialogState>()((set) => ({
  path: null,
  show: (path) => set({ path }),
  close: () => set({ path: null }),
}));

/// Path of `absolute` relative to `repoPath`, or the path itself when it lies outside.
export function repoRelativePath(repoPath: string, absolute: string): string {
  const root = repoPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const path = absolute.replace(/\\/g, "/");
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}
