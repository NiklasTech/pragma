import { describe, expect, it } from "vite-plus/test";

import type { Agent, AgentMemoryEntry } from "./types";
import {
  AGENT_NAME_MAX,
  containsSecret,
  isAgentNameUnique,
  memoryTotalChars,
  validateMemoryEntry,
} from "./validation";

function agent(id: string, name: string): Agent {
  return {
    id,
    name,
    brief: "Do the thing.",
    engine: { kind: "builtin", provider: "anthropic", model: "claude" },
    folders: [],
    memory: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

function entry(text: string, createdAt: number): AgentMemoryEntry {
  return { id: `memory-${createdAt}`, text, createdAt, source: "user" };
}

describe("agent name uniqueness", () => {
  const roster = [agent("1", "Reviewer"), agent("2", "Writer")];

  it("rejects an existing name regardless of case", () => {
    expect(isAgentNameUnique("Reviewer", roster)).toBe(false);
    expect(isAgentNameUnique("  reviewer  ", roster)).toBe(false);
    expect(isAgentNameUnique("REVIEWER", roster)).toBe(false);
  });

  it("allows a new name and the same agent on edit", () => {
    expect(isAgentNameUnique("Tester", roster)).toBe(true);
    expect(isAgentNameUnique("Reviewer", roster, "1")).toBe(true);
    expect(isAgentNameUnique("Writer", roster, "1")).toBe(false);
  });

  it("keeps the maximum name length", () => {
    expect(AGENT_NAME_MAX).toBe(40);
  });
});

describe("agent memory cap", () => {
  it("rejects a new entry when the roster already holds 50 entries", () => {
    const memory = Array.from({ length: 50 }, (_, index) => entry("note", index));
    expect(validateMemoryEntry("one more", memory)).toBe("Memory is full");
  });

  it("rejects a new entry that pushes the total past 16000 characters", () => {
    const memory = Array.from({ length: 40 }, (_, index) => entry("x".repeat(400), index));
    expect(memoryTotalChars(memory)).toBe(16000);
    expect(validateMemoryEntry("overflow", memory)).toBe("Memory is full");
  });

  it("rejects a single entry past 500 characters", () => {
    expect(validateMemoryEntry("x".repeat(501), [])).toBe("Memory text is too long");
  });

  it("accepts an entry within both caps", () => {
    const memory = [entry("short", 0)];
    expect(validateMemoryEntry("another", memory)).toBeNull();
  });
});

describe("agent memory secret rejection", () => {
  it("detects each blocked marker", () => {
    expect(containsSecret("key sk-abc123")).toBe(true);
    expect(containsSecret("token ghp_abc123")).toBe(true);
    expect(containsSecret("token github_pat_abc123")).toBe(true);
    expect(containsSecret("token xai-abc123")).toBe(true);
    expect(containsSecret("Authorization: Bearer abc123")).toBe(true);
  });

  it("rejects secret-shaped memory writes with the exact error", () => {
    expect(validateMemoryEntry("sk-live-secret", [])).toBe("Do not store secrets in memory");
    expect(validateMemoryEntry("Bearer abc", [])).toBe("Do not store secrets in memory");
  });

  it("accepts plain notes", () => {
    expect(containsSecret("Prefer small commits")).toBe(false);
    expect(validateMemoryEntry("Prefer small commits", [])).toBeNull();
  });
});
