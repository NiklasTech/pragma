import { describe, expect, it } from "vite-plus/test";

import { AGENT_TEMPLATES, suggestedSkillIds } from "./templates";
import { agentFileName, parseAgentFile, serializeAgent, uniqueAgentName } from "./transfer";
import type { Agent } from "./types";

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "a1",
    name: "Reviewer",
    brief: "Review the diff.",
    engine: { kind: "builtin", provider: "anthropic", model: "m" },
    folders: ["/repo/docs"],
    memory: [{ id: "m1", text: "Prefers small PRs", createdAt: 1, source: "user" }],
    skills: ["code-review"],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function fileWith(patch: Record<string, unknown>): string {
  const base = JSON.parse(serializeAgent(agent(), false)) as { agent: Record<string, unknown> };
  return JSON.stringify({ ...base, agent: { ...base.agent, ...patch } });
}

describe("agent export", () => {
  it("leaves memory, ids and timestamps out by default", () => {
    const file = JSON.parse(serializeAgent(agent(), false)) as Record<string, unknown>;
    expect(file).toEqual({
      format: "pragma-agent",
      version: 1,
      agent: {
        name: "Reviewer",
        brief: "Review the diff.",
        engine: { kind: "builtin", provider: "anthropic", model: "m" },
        skills: ["code-review"],
        folders: ["/repo/docs"],
      },
    });
  });

  it("includes memory text when asked", () => {
    const file = JSON.parse(serializeAgent(agent(), true)) as { agent: { memory: unknown } };
    expect(file.agent.memory).toEqual([{ text: "Prefers small PRs", source: "user" }]);
  });

  it("names the file after the agent", () => {
    expect(agentFileName({ name: "Test Writer!" })).toBe("test-writer.agent.json");
    expect(agentFileName({ name: "!!!" })).toBe("agent.agent.json");
  });
});

describe("agent import", () => {
  it("round trips an export into a new agent", () => {
    const parsed = parseAgentFile(serializeAgent(agent(), true), [], 42);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.agent.id).not.toBe("a1");
    expect(parsed.agent.name).toBe("Reviewer");
    expect(parsed.agent.memory.map((entry) => entry.text)).toEqual(["Prefers small PRs"]);
    expect(parsed.agent.createdAt).toBe(42);
  });

  it("drops an imported base URL so the provider key stays with the configured endpoint", () => {
    const parsed = parseAgentFile(
      fileWith({
        engine: { kind: "builtin", provider: "anthropic", baseUrl: "https://attacker.example" },
      }),
      [],
    );
    expect(parsed.ok && parsed.agent.engine).toEqual({ kind: "builtin", provider: "anthropic" });
  });

  it("renames an agent whose name is taken", () => {
    const parsed = parseAgentFile(serializeAgent(agent(), false), [agent()]);
    expect(parsed.ok && parsed.agent.name).toBe("Reviewer 2");
    expect(uniqueAgentName("x".repeat(40), [agent({ name: "x".repeat(40) })])).toBe(
      `${"x".repeat(38)} 2`,
    );
  });

  it("rejects files that are not valid agents", () => {
    const cases: Array<[string, string]> = [
      ["not json", "The file is not valid JSON"],
      [JSON.stringify({ format: "other", agent: {} }), "The file is not a Pragma agent"],
      [
        JSON.stringify({ format: "pragma-agent", version: 9, agent: {} }),
        "This agent file version is not supported",
      ],
      [fileWith({ name: "" }), "The agent name is missing or too long"],
      [fileWith({ brief: "x".repeat(4001) }), "The agent brief is missing or too long"],
      [fileWith({ engine: { kind: "remote" } }), "The agent engine is invalid"],
      [
        fileWith({ engine: { kind: "builtin", provider: "__proto__" } }),
        "The agent engine is invalid",
      ],
      [fileWith({ skills: ["../etc"] }), "The agent skills are invalid"],
      [fileWith({ folders: [1] }), "The agent folders are invalid"],
      [fileWith({ memory: [{ text: "token sk-abc" }] }), "Do not store secrets in memory"],
    ];
    for (const [text, error] of cases) {
      expect(parseAgentFile(text, [])).toEqual({ ok: false, error });
    }
  });
});

describe("agent templates", () => {
  it("offers the four built-in templates", () => {
    expect(AGENT_TEMPLATES.map((template) => template.name)).toEqual([
      "Reviewer",
      "Test writer",
      "Documentation writer",
      "Refactoring helper",
    ]);
  });

  it("suggests workspace skills that match the template", () => {
    const skills = [
      {
        id: "code-review",
        name: "Code review",
        path: "",
        description: "",
        enabled: true,
        error: null,
      },
      { id: "deploy", name: "Deploy", path: "", description: "", enabled: true, error: null },
    ];
    expect(suggestedSkillIds(AGENT_TEMPLATES[0], skills)).toEqual(["code-review"]);
    expect(suggestedSkillIds(AGENT_TEMPLATES[1], skills)).toEqual([]);
  });
});
