import { create } from "zustand";

import { cliSkillKey, writeEnabledCliSkill } from "./cliEnabled";
import { loadCliSkills } from "./cliStorage";
import { loadWorkspaceSkills, writeSkillEnabled } from "./storage";
import type { Skill } from "./types";

interface SkillsState {
  rootPath: string | null;
  skills: Skill[];
  /** The latest skills of every repository a session loaded them for, keyed by root. */
  byRoot: Record<string, Skill[]>;
  loadSkills: (rootPath: string | null) => Promise<void>;
  /** Loads the skills of a repository without changing the active one. */
  loadRepositorySkills: (rootPath: string) => Promise<Skill[]>;
  /** Reloads `rootPath`, or the active repository when it is omitted. */
  reloadSkills: (rootPath?: string) => Promise<void>;
  setWorkspaceEnabled: (skill: Skill, enabled: boolean) => Promise<void>;
}

async function readSkills(rootPath: string): Promise<Skill[]> {
  const pragma = await loadWorkspaceSkills(rootPath);
  const cli = await loadCliSkills(rootPath, new Set(pragma.map((skill) => skill.id)));
  cli.sort((a, b) => a.name.localeCompare(b.name));
  return [...pragma, ...cli];
}

export const useSkillsStore = create<SkillsState>()((set, get) => ({
  rootPath: null,
  skills: [],
  byRoot: {},

  loadSkills: async (rootPath) => {
    if (rootPath !== get().rootPath) set({ rootPath, skills: [] });
    if (!rootPath) return;
    const skills = await readSkills(rootPath);
    set((state) => ({
      byRoot: { ...state.byRoot, [rootPath]: skills },
      ...(state.rootPath === rootPath ? { skills } : {}),
    }));
  },

  loadRepositorySkills: async (rootPath) => {
    const skills = await readSkills(rootPath);
    set((state) => ({
      byRoot: { ...state.byRoot, [rootPath]: skills },
      ...(state.rootPath === rootPath ? { skills } : {}),
    }));
    return skills;
  },

  reloadSkills: async (rootPath) => {
    const active = get().rootPath;
    if (rootPath === undefined || rootPath === active) {
      await get().loadSkills(active);
      return;
    }
    await get().loadRepositorySkills(rootPath);
  },

  setWorkspaceEnabled: async (skill, enabled) => {
    const rootPath = get().rootPath;
    if (skill.source && rootPath) {
      writeEnabledCliSkill(rootPath, cliSkillKey(skill.source, skill.id), enabled);
    } else {
      await writeSkillEnabled(skill.path, enabled);
    }
    await get().reloadSkills();
  },
}));

/// The skills of a repository, read once and then served from the cache.
export async function repositorySkills(rootPath: string): Promise<Skill[]> {
  return (
    useSkillsStore.getState().byRoot[rootPath] ??
    useSkillsStore.getState().loadRepositorySkills(rootPath)
  );
}
