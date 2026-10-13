import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import { loadProjectAgents } from "@/features/ai/named-agents/projectStorage";
import { loadWorkspaceSkills } from "@/features/ai/skills/storage";

import { cliSyncFiles, type SkillWithContent } from "./plan";
import type { CliSyncTargetId } from "./targets";

/** Mirrors `CliSyncResult` in `src-tauri/src/modules/cli_sync.rs`. */
export interface CliSyncResult {
  written: string[];
  unchanged: string[];
  removed: string[];
  conflicts: { path: string; reason: string }[];
}

interface CliSyncState {
  rootPath: string | null;
  running: boolean;
  result: CliSyncResult | null;
  error: string | null;
  syncedAt: number | null;
  reset: (rootPath: string | null) => void;
  sync: (rootPath: string, targets: CliSyncTargetId[]) => Promise<void>;
}

async function readSkills(rootPath: string): Promise<SkillWithContent[]> {
  const skills = await loadWorkspaceSkills(rootPath);
  const read = await Promise.all(
    skills.map(async (skill) => {
      try {
        const file = await invoke<{ content: string }>("read_text_file", { path: skill.path });
        return { skill, content: file.content };
      } catch {
        return null;
      }
    }),
  );
  return read.filter((entry): entry is SkillWithContent => entry !== null);
}

let queue: Promise<void> = Promise.resolve();

/// The last sync of `.pragma` skills and agents into the coding CLI folders of the open folder.
export const useCliSyncStore = create<CliSyncState>()((set, get) => ({
  rootPath: null,
  running: false,
  result: null,
  error: null,
  syncedAt: null,

  reset: (rootPath) => {
    if (get().rootPath !== rootPath) {
      set({ rootPath, running: false, result: null, error: null, syncedAt: null });
    }
  },

  sync: (rootPath, targets) => {
    const run = async () => {
      if (get().rootPath !== rootPath) return;
      set({ running: true });
      try {
        const [skills, project] = await Promise.all([
          readSkills(rootPath),
          loadProjectAgents(rootPath),
        ]);
        const files = cliSyncFiles(rootPath, targets, skills, project.agents);
        const result = await invoke<CliSyncResult>("cli_sync_apply", { rootPath, files });
        if (get().rootPath === rootPath) {
          set({ result, error: null, syncedAt: Date.now() });
        }
      } catch (err) {
        if (get().rootPath === rootPath) set({ error: String(err), syncedAt: Date.now() });
      } finally {
        if (get().rootPath === rootPath) set({ running: false });
      }
    };
    queue = queue.then(run, run);
    return queue;
  },
}));
