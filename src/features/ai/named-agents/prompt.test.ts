import { describe, expect, it } from "vite-plus/test";

import { buildAgentSystemPrompt } from "@/features/agent/tools";

import { buildAgentContextBlock, composeAgentSystemPrompt } from "./prompt";
import type { Agent, AgentMemoryEntry } from "./types";

function entry(text: string, createdAt: number): AgentMemoryEntry {
  return { id: `memory-${createdAt}`, text, createdAt, source: "user" };
}

const agent: Agent = {
  id: "agent-1",
  name: "Reviewer",
  brief: "BRIEF_TEXT",
  engine: { kind: "builtin", provider: "anthropic", model: "claude" },
  folders: [],
  memory: [entry("MEMORY_NEW", 2), entry("MEMORY_OLD", 1)],
  skills: [],
  createdAt: 1,
  updatedAt: 1,
};

describe("agent system prompt order", () => {
  it("puts the brief first and memory newest last", () => {
    const block = buildAgentContextBlock(agent);
    expect(block.indexOf("BRIEF_TEXT")).toBeLessThan(block.indexOf("MEMORY_OLD"));
    expect(block.indexOf("MEMORY_OLD")).toBeLessThan(block.indexOf("MEMORY_NEW"));
  });

  it("puts project rules after the brief and memory", () => {
    const prompt = composeAgentSystemPrompt(buildAgentContextBlock(agent), "RULES_TEXT");
    expect(prompt).toBeDefined();
    const text = prompt ?? "";
    expect(text.indexOf("BRIEF_TEXT")).toBeLessThan(text.indexOf("MEMORY_NEW"));
    expect(text.indexOf("MEMORY_NEW")).toBeLessThan(text.indexOf("RULES_TEXT"));
  });

  it("omits empty blocks", () => {
    expect(composeAgentSystemPrompt(null, null)).toBeUndefined();
    expect(composeAgentSystemPrompt("", "RULES_TEXT")).toBe("RULES_TEXT");
  });

  it("keeps the agent block ahead of rules in the agent-mode prompt", () => {
    const block = buildAgentContextBlock(agent);
    const prompt = buildAgentSystemPrompt("/workspace", null, block);
    expect(prompt.indexOf("BRIEF_TEXT")).toBeLessThan(prompt.indexOf("Agent Mode"));
  });

  it("adds no block for a session with no agent", () => {
    const prompt = buildAgentSystemPrompt("/workspace", null, null);
    expect(prompt).not.toContain("Brief:");
  });
});
