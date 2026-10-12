import { invoke } from "@tauri-apps/api/core";

import { SKILL_FILE_NAME, skillsDir } from "./paths";
import { useSkillsStore } from "./store";

interface FileReadResult {
  content: string;
}

/** Reads the file of a loaded skill; an id the store does not know tries `<id>.md`, then `<id>/SKILL.md`. */
export async function readSkillFile(
  rootPath: string,
  id: string,
): Promise<{ path: string; content: string }> {
  const store = useSkillsStore.getState();
  const known =
    store.rootPath === rootPath
      ? store.skills.find((skill) => skill.id === id && skill.error === null)
      : undefined;
  const dir = skillsDir(rootPath);
  const candidates = known ? [known.path] : [`${dir}/${id}.md`, `${dir}/${id}/${SKILL_FILE_NAME}`];

  let lastError: unknown = new Error(`Skill ${id} not found`);
  for (const path of candidates) {
    try {
      const result = await invoke<FileReadResult>("read_text_file", { path });
      return { path, content: result.content };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
