import { create } from "zustand";

import { loadWorkspaceSkills, writeSkillEnabled } from "./storage";
import type { Skill } from "./types";

interface SkillsState {
  rootPath: string | null;
  skills: Skill[];
  loadSkills: (rootPath: string | null) => Promise<void>;
  reloadSkills: () => Promise<void>;
  setWorkspaceEnabled: (skill: Skill, enabled: boolean) => Promise<void>;
}

export const useSkillsStore = create<SkillsState>()((set, get) => ({
  rootPath: null,
  skills: [],

  loadSkills: async (rootPath) => {
    if (rootPath !== get().rootPath) set({ rootPath, skills: [] });
    if (!rootPath) return;
    const skills = await loadWorkspaceSkills(rootPath);
    if (get().rootPath === rootPath) set({ skills });
  },

  reloadSkills: () => get().loadSkills(get().rootPath),

  setWorkspaceEnabled: async (skill, enabled) => {
    await writeSkillEnabled(skill.path, enabled);
    await get().reloadSkills();
  },
}));
