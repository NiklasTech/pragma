import type { McpServerConfig } from "@/shared/stores/settings";

/** Mirrors `McpCli` in `src-tauri/src/modules/mcp/cli_configs.rs`. */
export type McpCli = "claude" | "codex" | "gemini" | "cursor";

/** Mirrors `McpImportCandidate` in `src-tauri/src/modules/mcp/import.rs`. */
export interface McpImportCandidate {
  /** The file it came from, for example "~/.codex/config.toml". */
  source: string;
  cli?: McpCli;
  server: McpServerConfig;
}

export interface McpCliInfo {
  cli: McpCli;
  /** The CLI manifest id the agent mark and the install state are keyed by. */
  manifestId: string;
  name: string;
}

export const MCP_CLIS: McpCliInfo[] = [
  { cli: "claude", manifestId: "anthropic-claude", name: "Claude Code" },
  { cli: "codex", manifestId: "openai-codex", name: "Codex" },
  { cli: "gemini", manifestId: "google-gemini", name: "Gemini CLI" },
  { cli: "cursor", manifestId: "cursor-agent", name: "Cursor" },
];

export function cliName(cli: McpCli): string {
  return MCP_CLIS.find((info) => info.cli === cli)?.name ?? cli;
}

/** Where each CLI lists a server, keyed by server name, then by CLI. */
export type McpUsage = Record<string, Partial<Record<McpCli, string>>>;

/** The configs that list each server name; the first file found per CLI wins. */
export function mcpUsage(candidates: McpImportCandidate[]): McpUsage {
  const usage: McpUsage = {};
  for (const { cli, source, server } of candidates) {
    if (!cli) continue;
    const entry = (usage[server.name] ??= {});
    entry[cli] ??= source;
  }
  return usage;
}

/** The CLIs worth a mark: the installed ones and any that lists a server. */
export function visibleClis(installed: Set<string>, usage: McpUsage): McpCliInfo[] {
  const listed = new Set<McpCli>();
  for (const entry of Object.values(usage)) {
    for (const cli of Object.keys(entry)) listed.add(cli as McpCli);
  }
  return MCP_CLIS.filter((info) => installed.has(info.manifestId) || listed.has(info.cli));
}

/** Every candidate whose name is not in Pragma yet, once, even when several configs list it. */
export function newCandidates(
  candidates: McpImportCandidate[],
  existingNames: Iterable<string>,
): McpImportCandidate[] {
  const names = new Set(existingNames);
  return candidates.filter((candidate) => {
    if (names.has(candidate.server.name)) return false;
    names.add(candidate.server.name);
    return true;
  });
}
