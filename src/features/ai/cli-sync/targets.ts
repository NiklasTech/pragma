import { CLI_AGENT_FOLDERS, CLI_SKILL_FOLDERS } from "@/features/ai/cli-folders/sources";

/** Mirrors `CliSyncTarget` in `src-tauri/src/modules/workspace_settings.rs`. */
export const CLI_SYNC_TARGETS = [
  "agents",
  "claude",
  "codex",
  "cursor",
  "gemini",
  "github",
] as const;

export type CliSyncTargetId = (typeof CLI_SYNC_TARGETS)[number];

export interface CliSyncAgentFolder {
  dir: string;
  ending: string;
  format: "markdown" | "toml";
}

export interface CliSyncFolders {
  skills: string | null;
  agents: CliSyncAgentFolder | null;
}

/** Codex reads skills from `.agents/skills`, so the `codex` target only writes agents. */
export function cliSyncFolders(target: CliSyncTargetId): CliSyncFolders {
  const skills =
    target === "codex"
      ? null
      : (CLI_SKILL_FOLDERS.find((folder) => folder.id === target)?.dir ?? null);
  const agentFolder = CLI_AGENT_FOLDERS.find((folder) => folder.id === target);
  const agents = agentFolder
    ? { dir: agentFolder.dir, ending: agentFolder.extensions[0], format: agentFolder.format }
    : null;
  return { skills, agents };
}
