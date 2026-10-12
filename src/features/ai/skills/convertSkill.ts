import { retargetTabs } from "@/features/editor/retargetTabs";
import { refreshFileTree } from "@/features/sidebar/lib/fileTreeRefresh";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { convertSkillFile } from "./storage";
import { useSkillsStore } from "./store";
import type { Skill } from "./types";

/** Converts a legacy skill to `<id>/SKILL.md`; open tabs and the file tree follow the file. */
export async function convertSkill(skill: Skill): Promise<void> {
  const path = await convertSkillFile(skill);
  retargetTabs(skill.path, path);
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (rootPath) await refreshFileTree(rootPath, [skill.path, path]);
  await useSkillsStore.getState().reloadSkills();
}
