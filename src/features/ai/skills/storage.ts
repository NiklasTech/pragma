import { invoke } from "@tauri-apps/api/core";

import { buildSkillTemplate, parseSkill, setSkillEnabled } from "./parse";
import { skillsDir } from "./paths";
import type { Skill } from "./types";

interface DirEntry {
  path: string;
  name: string;
  is_directory: boolean;
  is_file: boolean;
}

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

const MAX_NEW_SKILL_ATTEMPTS = 100;

export async function loadWorkspaceSkills(rootPath: string): Promise<Skill[]> {
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>("list_directory", { path: skillsDir(rootPath) });
  } catch {
    return [];
  }

  const files = entries.filter((entry) => entry.is_file && entry.name.endsWith(".md"));
  const skills = await Promise.all(
    files.map(async (entry): Promise<Skill> => {
      const id = entry.name.slice(0, -".md".length);
      try {
        const result = await invoke<FileReadResult>("read_text_file", { path: entry.path });
        return parseSkill(id, entry.path, result.content);
      } catch {
        return {
          id,
          path: entry.path,
          name: id,
          description: "",
          enabled: false,
          error: "Could not read the file",
        };
      }
    }),
  );
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSkillFile(rootPath: string): Promise<string> {
  const dir = skillsDir(rootPath);
  try {
    await invoke("create_directory", { path: dir });
  } catch {
    // The folder already exists; a real failure surfaces on create_file below.
  }

  let lastError = "Could not create the skill file";
  for (let attempt = 1; attempt <= MAX_NEW_SKILL_ATTEMPTS; attempt += 1) {
    const id = attempt === 1 ? "new-skill" : `new-skill-${attempt}`;
    const path = `${dir}/${id}.md`;
    try {
      await invoke("create_file", { path });
    } catch (err) {
      lastError = String(err);
      continue;
    }
    await invoke("write_text_file", { path, content: buildSkillTemplate("New skill") });
    return path;
  }
  throw new Error(lastError);
}

export async function writeSkillEnabled(path: string, enabled: boolean): Promise<void> {
  const result = await invoke<FileReadResult>("read_text_file", { path });
  const content = setSkillEnabled(result.content, enabled);
  if (content === null) throw new Error("Missing front matter");
  await invoke("write_text_file", { path, content });
}
