/** A project folder where coding CLIs keep skills or agents; Pragma only reads it. */
export interface CliFolder {
  /** Stable key, stored with enabled skills and in agent ids. */
  id: string;
  /** Shown next to entries read from this folder. */
  label: string;
  /** Relative to the workspace root. */
  dir: string;
}

export interface CliAgentFolder extends CliFolder {
  /** The CLI manifest the agent runs on by default. */
  cliProviderId: string;
  /** File endings in order of preference; the id is the file name without it. */
  extensions: string[];
  format: "markdown" | "toml";
}

/** Skill folders in `<dir>/<id>/SKILL.md`; earlier folders win on equal ids. */
export const CLI_SKILL_FOLDERS: CliFolder[] = [
  { id: "agents", label: ".agents", dir: ".agents/skills" },
  { id: "claude", label: ".claude", dir: ".claude/skills" },
  { id: "github", label: ".github", dir: ".github/skills" },
  { id: "cursor", label: ".cursor", dir: ".cursor/skills" },
  { id: "gemini", label: ".gemini", dir: ".gemini/skills" },
  { id: "opencode", label: ".opencode", dir: ".opencode/skills" },
];

/** Agent folders with one file per agent; earlier folders win on equal ids. */
export const CLI_AGENT_FOLDERS: CliAgentFolder[] = [
  {
    id: "claude",
    label: ".claude",
    dir: ".claude/agents",
    cliProviderId: "anthropic-claude",
    extensions: [".md"],
    format: "markdown",
  },
  {
    id: "codex",
    label: ".codex",
    dir: ".codex/agents",
    cliProviderId: "openai-codex",
    extensions: [".toml"],
    format: "toml",
  },
  {
    id: "gemini",
    label: ".gemini",
    dir: ".gemini/agents",
    cliProviderId: "google-gemini",
    extensions: [".md"],
    format: "markdown",
  },
  {
    id: "github",
    label: ".github",
    dir: ".github/agents",
    cliProviderId: "github-copilot",
    extensions: [".agent.md", ".md"],
    format: "markdown",
  },
  {
    id: "cursor",
    label: ".cursor",
    dir: ".cursor/agents",
    cliProviderId: "cursor-agent",
    extensions: [".md"],
    format: "markdown",
  },
  {
    id: "opencode",
    label: ".opencode",
    dir: ".opencode/agents",
    cliProviderId: "opencode",
    extensions: [".md"],
    format: "markdown",
  },
  {
    id: "grok",
    label: ".grok",
    dir: ".grok/agents",
    cliProviderId: "xai-grok",
    extensions: [".md"],
    format: "markdown",
  },
];

export function cliFolderPath(rootPath: string, folder: CliFolder): string {
  return `${rootPath.replace(/[\\/]+$/, "")}/${folder.dir}`;
}

function isBelow(path: string, dirs: string[]): boolean {
  const normalized = path.replace(/\\/g, "/");
  return dirs.some((dir) => normalized.includes(`/${dir}/`) || normalized.startsWith(`${dir}/`));
}

export function isCliSkillPath(path: string): boolean {
  return isBelow(
    path,
    CLI_SKILL_FOLDERS.map((folder) => folder.dir),
  );
}

export function isCliAgentPath(path: string): boolean {
  return isBelow(
    path,
    CLI_AGENT_FOLDERS.map((folder) => folder.dir),
  );
}

export function cliFolderLabel(folderId: string): string {
  return (
    [...CLI_SKILL_FOLDERS, ...CLI_AGENT_FOLDERS].find((folder) => folder.id === folderId)?.label ??
    folderId
  );
}
