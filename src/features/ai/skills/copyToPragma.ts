import { invoke } from "@tauri-apps/api/core";

import { FRONT_MATTER_PATTERN } from "./parse";
import { SKILL_FILE_NAME, skillsDir } from "./paths";
import type { Skill } from "./types";

interface DirEntry {
  path: string;
  is_file: boolean;
}

interface FileReadResult {
  content: string;
}

/** Adds `name: <id>` when the front matter has none, since `.pragma` skills require a name. */
export function withSkillName(content: string, id: string): string {
  const match = FRONT_MATTER_PATTERN.exec(content);
  if (!match || /^name\s*:\s*\S/m.test(match[1])) return content;
  const newline = content.startsWith("---\r\n") ? "\r\n" : "\n";
  return `---${newline}name: ${id}${newline}${content.slice(3 + newline.length)}`;
}

async function createDirectory(path: string): Promise<void> {
  try {
    await invoke("create_directory", { path });
  } catch (err) {
    if (!String(err).includes("Already exists")) throw err;
  }
}

/** Copies a discovered skill folder to `.pragma/skills/<id>/`; files that are not text are skipped. */
export async function copySkillToPragma(
  rootPath: string,
  skill: Skill,
): Promise<{ path: string; skipped: number }> {
  const sourceDir = skill.path.slice(0, -`/${SKILL_FILE_NAME}`.length);
  const targetDir = `${skillsDir(rootPath)}/${skill.id}`;
  await createDirectory(skillsDir(rootPath));
  try {
    await invoke("create_directory", { path: targetDir });
  } catch (err) {
    if (!String(err).includes("Already exists")) throw err;
    throw new Error(`A folder named ${skill.id} already exists in .pragma/skills`);
  }

  const entries = await invoke<DirEntry[]>("list_directory_recursive", { path: sourceDir });
  const created = new Set([targetDir]);
  let skipped = 0;
  for (const entry of entries.filter((item) => item.is_file)) {
    const relative = entry.path.slice(sourceDir.length + 1).replace(/\\/g, "/");
    const target = `${targetDir}/${relative}`;
    let content: string;
    try {
      content = (await invoke<FileReadResult>("read_text_file", { path: entry.path })).content;
    } catch {
      skipped += 1;
      continue;
    }
    const parent = target.slice(0, target.lastIndexOf("/"));
    if (!created.has(parent)) {
      await createDirectory(parent);
      created.add(parent);
    }
    const isSkillFile = relative === SKILL_FILE_NAME;
    await invoke("write_text_file", {
      path: target,
      content: isSkillFile ? withSkillName(content, skill.id) : content,
    });
  }
  return { path: `${targetDir}/${SKILL_FILE_NAME}`, skipped };
}
