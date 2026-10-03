import { invoke } from "@tauri-apps/api/core";

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface McpResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

const MENTION_PREFIX = "mcp:";
// Large resources would crowd out the conversation.
const MAX_RESOURCE_CHARS = 40_000;

export function resourceMention(serverId: string, uri: string): string {
  return `${MENTION_PREFIX}${serverId}:${uri}`;
}

export function parseResourceMention(mention: string): { serverId: string; uri: string } | null {
  if (!mention.startsWith(MENTION_PREFIX)) return null;
  const rest = mention.slice(MENTION_PREFIX.length);
  const separator = rest.indexOf(":");
  if (separator <= 0 || separator === rest.length - 1) return null;
  return { serverId: rest.slice(0, separator), uri: rest.slice(separator + 1) };
}

/// Text of the mentioned resources as one context block; binary contents are skipped.
export async function readResourceContext(mentions: string[]): Promise<string | null> {
  const sections: string[] = [];
  for (const mention of mentions) {
    const parsed = parseResourceMention(mention);
    if (!parsed) continue;
    const contents = await invoke<McpResourceContent[]>("mcp_read_resource", {
      id: parsed.serverId,
      uri: parsed.uri,
    });
    for (const content of contents) {
      if (content.text === undefined) continue;
      const truncated = content.text.length > MAX_RESOURCE_CHARS;
      const text = truncated ? content.text.slice(0, MAX_RESOURCE_CHARS) : content.text;
      sections.push(
        `--- MCP resource ${content.uri} ---\n${text}${truncated ? "\n[resource truncated]" : ""}`,
      );
    }
  }
  return sections.length > 0 ? sections.join("\n\n") : null;
}
