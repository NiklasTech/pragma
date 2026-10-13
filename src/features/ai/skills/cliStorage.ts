import { invoke } from "@tauri-apps/api/core";

import { CLI_SKILL_FOLDERS, cliFolderPath } from "@/features/ai/cli-folders/sources";

import { cliSkillKey, readEnabledCliSkills } from "./cliEnabled";
import { parseSkill } from "./parse";
import { listDirectory, standardSkillSources, type SkillSource } from "./storage";
import type { Skill } from "./types";

interface FileReadResult {
  content: string;
}

async function readCliSkill(source: SkillSource): Promise<Skill> {
  try {
    const result = await invoke<FileReadResult>("read_text_file", { path: source.path });
    return parseSkill(source.id, source.path, result.content, { nameFromId: true });
  } catch {
    return {
      id: source.id,
      path: source.path,
      name: source.id,
      description: "",
      enabled: false,
      error: "Could not read the file",
    };
  }
}

/** Skills in the folders of coding CLIs; ids in `takenIds` or in an earlier folder are left out. */
export async function loadCliSkills(rootPath: string, takenIds: Set<string>): Promise<Skill[]> {
  const perFolder = await Promise.all(
    CLI_SKILL_FOLDERS.map(async (folder) => ({
      folder,
      sources: await standardSkillSources(await listDirectory(cliFolderPath(rootPath, folder))),
    })),
  );

  const enabled = readEnabledCliSkills(rootPath);
  const seen = new Set(takenIds);
  const reads: Array<Promise<Skill>> = [];
  for (const { folder, sources } of perFolder) {
    for (const source of sources) {
      if (seen.has(source.id)) continue;
      seen.add(source.id);
      reads.push(
        readCliSkill(source).then((skill) => ({
          ...skill,
          enabled: enabled.has(cliSkillKey(folder.id, source.id)),
          source: folder.id,
        })),
      );
    }
  }
  return Promise.all(reads);
}
