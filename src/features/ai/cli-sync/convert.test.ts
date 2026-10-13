import { parse as parseToml } from "smol-toml";
import { describe, expect, it } from "vite-plus/test";

import type { Agent } from "@/features/ai/named-agents/types";
import type { Skill } from "@/features/ai/skills/types";

import { syncedAgentContent, syncedSkillContent } from "./convert";

function skill(id: string, path: string): Skill {
  return { id, path, name: "Review", description: "Reviews: code.", enabled: true, error: null };
}

function agent(patch: Partial<Agent> = {}): Agent {
  return {
    id: "project:reviewer",
    name: "Code Reviewer",
    description: "Reviews pull requests.",
    brief: "Read the diff.\n\nReport bugs.",
    engine: { kind: "builtin", provider: "anthropic", model: "claude-sonnet-5-5" },
    folders: [],
    memory: [],
    skills: [],
    scope: "project",
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

describe("skill conversion", () => {
  it("drops enabled from SKILL.md and keeps everything else", () => {
    const content = "---\nname: review\nenabled: true\nlicense: MIT\n---\n\nRead the diff.\n";
    expect(syncedSkillContent(skill("review", "/w/.pragma/skills/review/SKILL.md"), content)).toBe(
      "---\nname: review\nlicense: MIT\n---\n\nRead the diff.\n",
    );
  });

  it("rebuilds the front matter of a single-file skill as YAML", () => {
    const content =
      "---\nname: Review\ndescription: Reviews: code.\nenabled: true\n---\n\n## Steps\n";
    expect(syncedSkillContent(skill("review", "/w/.pragma/skills/review.md"), content)).toBe(
      '---\nname: Review\ndescription: "Reviews: code."\n---\n\n## Steps\n',
    );
  });

  it("skips content without front matter", () => {
    expect(syncedSkillContent(skill("review", "/w/.pragma/skills/review.md"), "Steps")).toBeNull();
  });
});

describe("agent conversion", () => {
  it("writes Markdown with name, description, model and the brief for Claude Code", () => {
    expect(syncedAgentContent("claude", "markdown", "reviewer", agent())).toBe(
      "---\nname: reviewer\ndescription: Reviews pull requests.\nmodel: claude-sonnet-5-5\n---\n\nRead the diff.\n\nReport bugs.\n",
    );
  });

  it("keeps the model only for the CLI of the agent's provider", () => {
    for (const target of ["cursor", "github", "gemini"] as const) {
      expect(syncedAgentContent(target, "markdown", "reviewer", agent())).not.toContain("model:");
    }
    const gemini = agent({ engine: { kind: "builtin", provider: "gemini", model: "gemini-3" } });
    expect(syncedAgentContent("gemini", "markdown", "reviewer", gemini)).toContain(
      "model: gemini-3",
    );
    const cli = agent({ engine: { kind: "cli", cliProviderId: "anthropic-claude" } });
    expect(syncedAgentContent("claude", "markdown", "reviewer", cli)).not.toContain("model:");
  });

  it("falls back to the agent name without a description", () => {
    const content = syncedAgentContent(
      "cursor",
      "markdown",
      "reviewer",
      agent({ description: undefined }),
    );
    expect(content).toContain("description: Code Reviewer\n");
  });

  it("writes Codex TOML with developer_instructions", () => {
    const openai = agent({ engine: { kind: "builtin", provider: "openai", model: "gpt-6" } });
    const parsed = parseToml(syncedAgentContent("codex", "toml", "reviewer", openai));
    expect(parsed).toEqual({
      name: "reviewer",
      description: "Reviews pull requests.",
      model: "gpt-6",
      developer_instructions: "Read the diff.\n\nReport bugs.",
    });
  });
});
