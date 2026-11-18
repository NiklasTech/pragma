import { CLI_SKILL_FOLDERS } from "@/features/ai/cli-folders/sources";

import type { Skill } from "./types";

export interface SkillUser {
  /** CLI manifest id, for the agent mark. */
  manifestId: string;
  name: string;
}

// Codex reads `.agents/skills`; the other CLIs read their own folder.
const FOLDER_USERS: Record<string, SkillUser> = {
  agents: { manifestId: "openai-codex", name: "Codex" },
  claude: { manifestId: "anthropic-claude", name: "Claude Code" },
  github: { manifestId: "github-copilot", name: "GitHub Copilot CLI" },
  cursor: { manifestId: "cursor-agent", name: "Cursor" },
  gemini: { manifestId: "google-gemini", name: "Gemini CLI" },
  opencode: { manifestId: "opencode", name: "OpenCode" },
};

/** The folder a skill lives in, relative to the workspace. */
export function skillFolder(skill: Skill): string {
  if (!skill.source) return ".pragma/skills";
  return CLI_SKILL_FOLDERS.find((folder) => folder.id === skill.source)?.dir ?? skill.source;
}

/// The coding CLIs that read a skill: the one owning its folder, or for a `.pragma` skill the
/// folders `cliSync` copies it into. The `codex` sync target writes agents only.
export function skillUsers(skill: Skill, syncTargets: readonly string[] | undefined): SkillUser[] {
  if (skill.error !== null) return [];
  const folders = skill.source
    ? [skill.source]
    : (syncTargets ?? []).filter((target) => target !== "codex");
  const users = folders.flatMap((folder) => FOLDER_USERS[folder] ?? []);
  return users.filter(
    (user, index) => users.findIndex((other) => other.manifestId === user.manifestId) === index,
  );
}
