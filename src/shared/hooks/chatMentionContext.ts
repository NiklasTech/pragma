import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { parseMentions, stripMentions, type ChatContextResult } from "@/shared/lib/chat-context";
import { parseResourceMention, readResourceContext } from "@/features/ai/mcp/resources";
import { parseContextMention, type ContextMention } from "@/features/ai/mentions/contextMentions";
import { readContextMentions } from "@/features/ai/mentions/resolveContextMentions";

interface MentionContext {
  question: string;
  contextParts: string[];
}

// Resolves @file, MCP resource and context mentions; null means one could not be read.
export async function resolveMentionContext(
  raw: string,
  rootPath: string,
): Promise<MentionContext | null> {
  const mentions = parseMentions(raw);
  const resourceMentions = mentions.filter((mention) => parseResourceMention(mention));
  const contextMentions = mentions
    .map(parseContextMention)
    .filter((mention): mention is ContextMention => mention !== null);
  const fileMentions = mentions.filter(
    (mention) => !parseResourceMention(mention) && !parseContextMention(mention),
  );
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

  if (contextMentions.length > 0) {
    try {
      const context = await readContextMentions(contextMentions, rootPath);
      if (context) {
        question = stripMentions(raw);
        contextParts.push(context);
      }
    } catch (err) {
      toast.error(`Could not attach ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  return { question, contextParts };
}
