import { useMemo } from "react";
import type { UIMessage } from "ai";

import { AGENT_TOOL_NAMES } from "@/features/agent/tools";
import { getToolInvocation } from "@/shared/lib/ai/protocol";
import { useAIStore } from "@/shared/stores/ai";

import { Message, MessageContent } from "../components/Message";
import { ChildSessionCard } from "./ChildSessionCard";
import { childSessions } from "./limits";
import { readSpawnOutput } from "./spawn";

export function inlineChildIds(messages: UIMessage[]): string[] {
  const ids: string[] = [];
  for (const message of messages) {
    for (const part of message.parts) {
      const invocation = getToolInvocation(part);
      if (invocation?.toolName !== AGENT_TOOL_NAMES.spawnSession) continue;
      const child = readSpawnOutput(invocation.output);
      if (child) ids.push(child.sessionId);
    }
  }
  return ids;
}

/// Children the transcript does not show inline, e.g. after a reload dropped the tool calls.
export function ChildSessionCards({
  parentId,
  shownInline = [],
}: {
  parentId: string | null;
  shownInline?: string[];
}) {
  const chatSessions = useAIStore((state) => state.chatSessions);
  const inlineKey = shownInline.join("\n");
  const children = useMemo(() => {
    if (!parentId) return [];
    const inline = new Set(inlineKey.split("\n"));
    return childSessions(chatSessions, parentId)
      .filter((child) => !inline.has(child.id))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [chatSessions, inlineKey, parentId]);

  if (children.length === 0) return null;

  return (
    <Message from="assistant">
      <MessageContent>
        {children.map((child) => (
          <ChildSessionCard key={child.id} sessionId={child.id} title={child.title} />
        ))}
      </MessageContent>
    </Message>
  );
}
