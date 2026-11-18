import { describe, expect, it } from "vite-plus/test";

import { skillFolder, skillUsers } from "./skillUsers";
import type { Skill } from "./types";

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "review",
    path: "/repo/.pragma/skills/review/SKILL.md",
    name: "review",
    description: "Review a pull request",
    enabled: true,
    error: null,
    ...overrides,
  };
}

describe("skillUsers", () => {
  it("names the CLI that owns the folder", () => {
    const users = skillUsers(skill({ source: "claude" }), ["gemini"]);
    expect(users.map((user) => user.manifestId)).toEqual(["anthropic-claude"]);
    expect(skillUsers(skill({ source: "agents" }), undefined)[0]?.name).toBe("Codex");
  });

  it("follows the sync targets for a .pragma skill, without the agents-only codex target", () => {
    const users = skillUsers(skill(), ["claude", "codex", "agents", "gemini"]);
    expect(users.map((user) => user.manifestId)).toEqual([
      "anthropic-claude",
      "openai-codex",
      "google-gemini",
    ]);
    expect(skillUsers(skill(), undefined)).toEqual([]);
  });

  it("has no users while the skill is broken", () => {
    expect(skillUsers(skill({ source: "claude", error: "no description" }), [])).toEqual([]);
  });
});

describe("skillFolder", () => {
  it("shows the folder relative to the workspace", () => {
    expect(skillFolder(skill())).toBe(".pragma/skills");
    expect(skillFolder(skill({ source: "cursor" }))).toBe(".cursor/skills");
  });
});
