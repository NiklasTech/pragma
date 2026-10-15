import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

import type { GitStatusSnapshot } from "./git/types";

export interface RepositoryGitStatus {
  snapshot: GitStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
}

interface RepositoryGitState {
  /** Git status of open repositories other than the active one, keyed by root path. */
  byRoot: Record<string, RepositoryGitStatus>;
  loadStatus: (rootPath: string) => Promise<void>;
  unload: (rootPath: string) => void;
  stage: (rootPath: string, paths: string[]) => Promise<void>;
  unstage: (rootPath: string, paths: string[]) => Promise<void>;
  commit: (rootPath: string, message: string) => Promise<boolean>;
}

const EMPTY: RepositoryGitStatus = { snapshot: null, loading: false, error: null, busy: false };

export const useRepositoryGitStore = create<RepositoryGitState>()((set, get) => {
  const patch = (rootPath: string, update: Partial<RepositoryGitStatus>) =>
    set((state) => ({
      byRoot: { ...state.byRoot, [rootPath]: { ...(state.byRoot[rootPath] ?? EMPTY), ...update } },
    }));

  const run = async (rootPath: string, action: () => Promise<unknown>): Promise<boolean> => {
    patch(rootPath, { busy: true, error: null });
    try {
      await action();
      return true;
    } catch (err) {
      patch(rootPath, { error: String(err) });
      return false;
    } finally {
      patch(rootPath, { busy: false });
      await get().loadStatus(rootPath);
    }
  };

  return {
    byRoot: {},

    loadStatus: async (rootPath) => {
      patch(rootPath, { loading: true });
      try {
        const result = await invoke<{ snapshot: GitStatusSnapshot }>("git_status", {
          repoPath: rootPath,
        });
        if (rootPath in get().byRoot)
          patch(rootPath, { snapshot: result.snapshot, loading: false });
      } catch (err) {
        if (rootPath in get().byRoot) {
          patch(rootPath, { snapshot: null, loading: false, error: String(err) });
        }
      }
    },

    unload: (rootPath) => {
      if (!(rootPath in get().byRoot)) return;
      set((state) => {
        const byRoot = { ...state.byRoot };
        delete byRoot[rootPath];
        return { byRoot };
      });
    },

    stage: async (rootPath, paths) => {
      await run(rootPath, () => invoke("git_stage", { repoPath: rootPath, paths }));
    },

    unstage: async (rootPath, paths) => {
      await run(rootPath, () => invoke("git_unstage", { repoPath: rootPath, paths }));
    },

    commit: async (rootPath, message) => {
      const trimmed = message.trim();
      if (!trimmed) return false;
      return run(rootPath, () => invoke("git_commit", { repoPath: rootPath, message: trimmed }));
    },
  };
});
