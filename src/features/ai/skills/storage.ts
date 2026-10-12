import { invoke } from "@tauri-apps/api/core";

import { buildSkillTemplate, parseSkill, setSkillEnabled } from "./parse";
import { SKILL_FILE_NAME, skillsDir } from "./paths";
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

interface SkillSource {
  id: string;
  path: string;
}

const DUPLICATE_ERROR = "Duplicate skill id";

async function listDirectory(path: string): Promise<DirEntry[]> {
  try {
    return await invoke<DirEntry[]>("list_directory", { path });
  } catch {
    return [];
  }
}

async function standardSkillSources(entries: DirEntry[]): Promise<SkillSource[]> {
  const folders = await Promise.all(
    entries
      .filter((entry) => entry.is_directory)
      .map(async (folder): Promise<SkillSource | null> => {
        const files = await listDirectory(folder.path);
        const skillFile = files.find((file) => file.is_file && file.name === SKILL_FILE_NAME);
        return skillFile ? { id: folder.name, path: skillFile.path } : null;
      }),
  );
  return folders.filter((source): source is SkillSource => source !== null);
}

async function readSkill({ id, path }: SkillSource): Promise<Skill> {
  try {
    const result = await invoke<FileReadResult>("read_text_file", { path });
    return parseSkill(id, path, result.content);
  } catch {
    return {
      id,
      path,
      name: id,
      description: "",
      enabled: false,
      error: "Could not read the file",
    };
  }
}

export async function loadWorkspaceSkills(rootPath: string): Promise<Skill[]> {
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>("list_directory", { path: skillsDir(rootPath) });
  } catch {
    return [];
  }

  const legacy = entries
    .filter((entry) => entry.is_file && entry.name.endsWith(".md"))
    .map((entry) => ({ id: entry.name.slice(0, -".md".length), path: entry.path }));
  const standard = await standardSkillSources(entries);
  const standardIds = new Set(standard.map((source) => source.id));

  const skills = await Promise.all([
    ...standard.map(readSkill),
    ...legacy.map(async (source) => {
      const skill = await readSkill(source);
      return standardIds.has(source.id) ? { ...skill, error: DUPLICATE_ERROR } : skill;
    }),
  ]);
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSkillFile(rootPath: string): Promise<string> {
  const dir = skillsDir(rootPath);
  try {
    await invoke("create_directory", { path: dir });
  } catch {
    // The folder already exists; a real failure surfaces on create_directory below.
  }

  const taken = new Set(
    (await listDirectory(dir)).map((entry) =>
      entry.is_file && entry.name.endsWith(".md") ? entry.name.slice(0, -".md".length) : entry.name,
    ),
  );
  let lastError = "Could not create the skill file";
  for (let attempt = 1; attempt <= MAX_NEW_SKILL_ATTEMPTS; attempt += 1) {
    const id = attempt === 1 ? "new-skill" : `new-skill-${attempt}`;
    if (taken.has(id)) continue;
    try {
      await invoke("create_directory", { path: `${dir}/${id}` });
    } catch (err) {
      lastError = String(err);
      continue;
    }
    const path = `${dir}/${id}/${SKILL_FILE_NAME}`;
    await invoke("create_file", { path });
    await invoke("write_text_file", { path, content: buildSkillTemplate(id) });
    return path;
  }
  throw new Error(lastError);
}

/** Moves `<id>.md` to `<id>/SKILL.md` without changing its content and returns the new path. */
export async function convertSkillFile(skill: Skill): Promise<string> {
  const folder = skill.path.replace(/\.md$/, "");
  try {
    await invoke("create_directory", { path: folder });
  } catch (err) {
    if (!String(err).includes("Already exists")) throw err;
    throw new Error(`A folder named ${skill.id} already exists in .pragma/skills`);
  }
  const path = `${folder}/${SKILL_FILE_NAME}`;
  try {
    await invoke("rename_file", { oldPath: skill.path, newPath: path });
  } catch (err) {
    await invoke("delete_file", { path: folder }).catch(() => undefined);
    throw err;
  }
  return path;
}

export async function writeSkillEnabled(path: string, enabled: boolean): Promise<void> {
  const result = await invoke<FileReadResult>("read_text_file", { path });
  const content = setSkillEnabled(result.content, enabled);
  if (content === null) throw new Error("Missing front matter");
  await invoke("write_text_file", { path, content });
}
