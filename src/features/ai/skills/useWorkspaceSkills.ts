import { useEffect } from "react";

import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { useSkillsStore } from "./store";
import type { Skill } from "./types";

export function useWorkspaceSkills(): Skill[] {
  const rootPath = useFileExplorerStore((state) => state.rootPath);
  const skills = useSkillsStore((state) => state.skills);

  useEffect(() => {
    void useSkillsStore.getState().loadSkills(rootPath);
  }, [rootPath]);

  return skills;
}
