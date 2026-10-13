import { create } from "zustand";

import { cliSkillKey, writeEnabledCliSkill } from "./cliEnabled";
import { loadCliSkills } from "./cliStorage";
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
    const pragma = await loadWorkspaceSkills(rootPath);
    const cli = await loadCliSkills(rootPath, new Set(pragma.map((skill) => skill.id)));
    cli.sort((a, b) => a.name.localeCompare(b.name));
    if (get().rootPath === rootPath) set({ skills: [...pragma, ...cli] });
  },

  reloadSkills: () => get().loadSkills(get().rootPath),

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
