import type { Agent } from "./types";

export function buildAgentContextBlock(agent: Agent): string {
  const sections = [`Brief:\n${agent.brief}`];
  if (agent.memory.length > 0) {
    const newestLast = [...agent.memory].sort((a, b) => a.createdAt - b.createdAt);
    sections.push(`Memory:\n${newestLast.map((entry) => `- ${entry.text}`).join("\n")}`);
  }
  return sections.join("\n\n");
}

export function composeAgentSystemPrompt(...parts: Array<string | null>): string | undefined {
  const blocks = parts.filter((block): block is string =>
    Boolean(block && block.trim().length > 0),
  );
  if (blocks.length === 0) return undefined;
  return blocks.join("\n\n");
}
