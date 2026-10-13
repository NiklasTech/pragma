import { toast } from "sonner";

import { refreshFileTree } from "@/features/sidebar/lib/fileTreeRefresh";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";

import { copySkillToPragma } from "./copyToPragma";
import { skillsDir } from "./paths";
import { useSkillsStore } from "./store";
import type { Skill } from "./types";

/** Copies a discovered skill to `.pragma/skills`, where it then takes precedence. */
export async function copySkill(skill: Skill): Promise<void> {
  const rootPath = useFileExplorerStore.getState().rootPath;
  if (!rootPath) throw new Error("Open a folder to copy skills");
  const { skipped } = await copySkillToPragma(rootPath, skill);
  await refreshFileTree(rootPath, [`${skillsDir(rootPath)}/${skill.id}`]);
  await useSkillsStore.getState().reloadSkills();
  toast.success(`Copied ${skill.name} to .pragma/skills`, {
    description: skipped > 0 ? `${skipped} files that are not text were not copied.` : undefined,
  });
}
