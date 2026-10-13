import { normalizePath } from "@/features/ai/named-agents/folders";
import { projectAgentFileId } from "@/features/ai/named-agents/projectFile";
import type { Agent } from "@/features/ai/named-agents/types";
import { SKILL_FILE_NAME } from "@/features/ai/skills/paths";
import type { Skill } from "@/features/ai/skills/types";

import { syncedAgentContent, syncedSkillContent } from "./convert";
import { cliSyncFolders, type CliSyncTargetId } from "./targets";

/** Mirrors `CliSyncFile` in `src-tauri/src/modules/cli_sync.rs`; paths are relative to the root. */
export interface CliSyncFile {
  path: string;
  source: string;
  content: string;
}

export interface SkillWithContent {
  skill: Skill;
  content: string;
}

export function relativeToRoot(rootPath: string, path: string): string | null {
  const root = normalizePath(rootPath);
  const full = normalizePath(path);
  return full.startsWith(`${root}/`) ? full.slice(root.length + 1) : null;
}

/** The files each enabled target gets: valid, enabled `.pragma` skills and valid project agents. */
export function cliSyncFiles(
  rootPath: string,
  targets: CliSyncTargetId[],
  skills: SkillWithContent[],
  agents: Agent[],
): CliSyncFile[] {
  const files: CliSyncFile[] = [];
  for (const { skill, content } of skills) {
    const source = relativeToRoot(rootPath, skill.path);
    const synced = syncedSkillContent(skill, content);
    if (skill.source || skill.error || !skill.enabled || !source || synced === null) continue;
    for (const target of targets) {
      const dir = cliSyncFolders(target).skills;
      if (dir)
        files.push({ path: `${dir}/${skill.id}/${SKILL_FILE_NAME}`, source, content: synced });
    }
  }
  for (const agent of agents) {
    const fileId = projectAgentFileId(agent.id);
    if (!fileId || agent.source) continue;
    const source = `.pragma/agents/${fileId}.md`;
    for (const target of targets) {
      const folder = cliSyncFolders(target).agents;
      if (!folder) continue;
      files.push({
        path: `${folder.dir}/${fileId}${folder.ending}`,
        source,
        content: syncedAgentContent(target, folder.format, fileId, agent),
      });
    }
  }
  return files;
}
