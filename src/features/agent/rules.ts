import { invoke } from "@tauri-apps/api/core";

export const CHAR_CAP = 8000;

export const RULES_FILENAMES = ["PRAGMA.md", "AGENTS.md", "CLAUDE.md"] as const;

export interface ProjectRules {
  path: string;
  source: string;
  truncated: boolean;
}

interface FileReadResult {
  path: string;
  name: string;
  content: string;
}

export function selectRulesFile(present: readonly string[]): string | null {
  for (const name of RULES_FILENAMES) {
    if (present.includes(name)) return name;
  }
  return null;
}

export function truncateRulesContent(source: string): { content: string; truncated: boolean } {
  if (source.length <= CHAR_CAP) return { content: source, truncated: false };
  return {
    content: [
      `Note: this project rules file was truncated to the first ${CHAR_CAP} characters because it exceeds the size limit.`,
      "",
      source.slice(0, CHAR_CAP),
      "",
      "[remaining content truncated]",
    ].join("\n"),
    truncated: true,
  };
}

export function formatRulesForPrompt(rules: ProjectRules | null): string {
  if (!rules) return "";
  return [
    "The following project rules apply. Follow them in your responses:",
    `--- ${rules.path} ---`,
    rules.source,
    `--- end ${rules.path} ---`,
  ].join("\n");
}

export async function loadProjectRules(rootPath: string): Promise<ProjectRules | null> {
  for (const name of RULES_FILENAMES) {
    const path = `${rootPath.replace(/[\\/]+$/, "")}/${name}`;
    try {
      const result = await invoke<FileReadResult>("read_text_file", { path });
      const { content, truncated } = truncateRulesContent(result.content);
      return { path: name, source: content, truncated };
    } catch {
      // Not present; try the next candidate.
    }
  }
  return null;
}
