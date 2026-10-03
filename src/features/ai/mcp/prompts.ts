import { invoke } from "@tauri-apps/api/core";

import { isMcpServerAllowed } from "./selection";

export interface McpPromptArgument {
  name: string;
  description?: string;
  required: boolean;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments: McpPromptArgument[];
}

interface McpPromptMessage {
  role: string;
  text: string;
}

interface ServerState {
  config: { id: string; name: string };
  status: string;
}

/// Server names become the command prefix, e.g. "GitHub Tools" -> "github-tools".
export function serverSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "mcp";
}

export function promptCommand(serverName: string, promptName: string): string {
  return `/${serverSlug(serverName)}:${promptName}`;
}

/// The command plus a `name=""` placeholder per argument, required ones first.
export function promptTemplate(serverName: string, prompt: McpPrompt): string {
  const args = [...prompt.arguments]
    .sort((a, b) => Number(b.required) - Number(a.required))
    .map((arg) => `${arg.name}=""`);
  return [promptCommand(serverName, prompt.name), ...args].join(" ");
}

export interface ParsedPromptCommand {
  slug: string;
  prompt: string;
  arguments: Record<string, string>;
}

const COMMAND_PATTERN = /^\/([a-z0-9-]+):(\S+)(?:\s+([\s\S]*))?$/;
const ARGUMENT_PATTERN = /([A-Za-z_][\w-]*)=(?:"((?:[^"\\]|\\.)*)"|(\S*))/g;

export function parsePromptCommand(text: string): ParsedPromptCommand | null {
  const match = COMMAND_PATTERN.exec(text.trim());
  if (!match) return null;
  const args: Record<string, string> = {};
  for (const arg of (match[3] ?? "").matchAll(ARGUMENT_PATTERN)) {
    const value = arg[2] !== undefined ? arg[2].replace(/\\(.)/g, "$1") : (arg[3] ?? "");
    if (value) args[arg[1]] = value;
  }
  return { slug: match[1], prompt: match[2], arguments: args };
}

/// Replaces a `/server:prompt key="value"` command with the prompt's messages.
/// Text that is not a command for an allowed server is returned unchanged.
export async function expandPromptCommand(
  text: string,
  allowedServerIds: string[] | null,
): Promise<string> {
  const parsed = parsePromptCommand(text);
  if (!parsed) return text;

  const servers = await invoke<ServerState[]>("mcp_list_servers");
  const server = servers.find(
    (item) =>
      item.status === "running" &&
      serverSlug(item.config.name) === parsed.slug &&
      isMcpServerAllowed(allowedServerIds, item.config.id),
  );
  if (!server) return text;

  const messages = await invoke<McpPromptMessage[]>("mcp_get_prompt", {
    id: server.config.id,
    name: parsed.prompt,
    arguments: parsed.arguments,
  });
  const expanded = messages.map((message) => message.text.trim()).filter(Boolean);
  if (expanded.length === 0) {
    throw new Error(`The prompt ${parsed.prompt} returned no text`);
  }
  return expanded.join("\n\n");
}
