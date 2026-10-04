import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { parseMentions, stripMentions, type ChatContextResult } from "@/shared/lib/chat-context";
import { parseResourceMention, readResourceContext } from "@/features/ai/mcp/resources";

interface MentionContext {
  question: string;
  contextParts: string[];
}

// Resolves @file and MCP resource mentions; null means a resource could not be read.
export async function resolveMentionContext(
  raw: string,
  rootPath: string,
): Promise<MentionContext | null> {
  const mentions = parseMentions(raw);
  const resourceMentions = mentions.filter((mention) => parseResourceMention(mention));
  const fileMentions = mentions.filter((mention) => !parseResourceMention(mention));
  let question = raw.trim();
  const contextParts: string[] = [];

  if (rootPath && fileMentions.length > 0) {
    try {
      const result = await invoke<ChatContextResult>("read_chat_context", {
        req: { root_path: rootPath, paths: fileMentions },
      });

      if (result.content) {
        question = stripMentions(raw);
        contextParts.push(result.content);
      }
    } catch {}
  }

  if (resourceMentions.length > 0) {
    try {
      const resources = await readResourceContext(resourceMentions);
      if (resources) {
        question = stripMentions(raw);
        contextParts.push(resources);
      }
    } catch (err) {
      toast.error(`Could not read the MCP resource: ${String(err)}`);
      return null;
    }
  }

  return { question, contextParts };
}
