import type { UIMessage } from "ai";

import { generateId } from "./id";

const SUMMARY_HEADER = "Summary of the earlier conversation, which was compacted to save context:";

/** A summary that stands in for every message before it when a request is built. */
export function isCompactionMessage(message: Pick<UIMessage, "role" | "metadata">): boolean {
  const { metadata } = message;
  return (
    message.role === "system" &&
    typeof metadata === "object" &&
    metadata !== null &&
    "kind" in metadata &&
    metadata.kind === "compaction"
  );
}

export function createCompactionMessage(summary: string, id: string = generateId()): UIMessage {
  return {
    id,
    role: "system",
    metadata: { kind: "compaction" },
    parts: [{ type: "text", text: summary }],
  };
}

export function compactionSummary(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
}

/// The messages a request sends: those after the latest summary, with the summary leading the first user turn.
export function requestMessages(messages: UIMessage[]): UIMessage[] {
  let markerIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (isCompactionMessage(messages[i])) {
      markerIndex = i;
      break;
    }
  }
  if (markerIndex === -1) return messages;

  const preamble = `${SUMMARY_HEADER}\n\n${compactionSummary(messages[markerIndex])}\n\n`;
  const rest = messages.slice(markerIndex + 1);
  const firstUser = rest.findIndex((message) => message.role === "user");
  if (firstUser === -1) {
    return [{ id: generateId(), role: "user", parts: [{ type: "text", text: preamble }] }, ...rest];
  }
  return rest.map((message, index) =>
    index === firstUser
      ? { ...message, parts: [{ type: "text", text: preamble }, ...message.parts] }
      : message,
  );
}
