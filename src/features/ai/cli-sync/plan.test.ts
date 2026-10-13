import { describe, expect, it } from "vite-plus/test";

import type { Agent } from "@/features/ai/named-agents/types";
import type { Skill } from "@/features/ai/skills/types";

import { cliSyncFiles, relativeToRoot } from "./plan";

const ROOT = "/work/app";
const CONTENT = "---\nname: review\ndescription: Reviews code.\n---\n\nRead the diff.\n";

function skill(patch: Partial<Skill> = {}): { skill: Skill; content: string } {
  return {
    skill: {
      id: "review",
      path: `${ROOT}/.pragma/skills/review/SKILL.md`,
      name: "review",
      description: "Reviews code.",
      enabled: true,
      error: null,
      ...patch,
    },
    content: CONTENT,
  };
}

const AGENT: Agent = {
  id: "project:reviewer",
  name: "Reviewer",
  brief: "Read the diff.",
  engine: { kind: "cli", cliProviderId: "anthropic-claude" },
  folders: [],
  memory: [],
  skills: [],
  scope: "project",
  createdAt: 1,
  updatedAt: 1,
};

describe("cli sync files", () => {
  it("writes skills and agents into the folders of each target", () => {
    const files = cliSyncFiles(ROOT, ["claude", "agents", "codex"], [skill()], [AGENT]);
    expect(files.map((file) => [file.path, file.source])).toEqual([
      [".claude/skills/review/SKILL.md", ".pragma/skills/review/SKILL.md"],
      [".agents/skills/review/SKILL.md", ".pragma/skills/review/SKILL.md"],
      [".claude/agents/reviewer.md", ".pragma/agents/reviewer.md"],
      [".codex/agents/reviewer.toml", ".pragma/agents/reviewer.md"],
    ]);
  });

  it("uses the Copilot agent file ending", () => {
    const files = cliSyncFiles(ROOT, ["github"], [], [AGENT]);
    expect(files.map((file) => file.path)).toEqual([".github/agents/reviewer.agent.md"]);
  });

  it("leaves out disabled, broken and discovered skills and agents", () => {
    const skills = [
      skill({ enabled: false }),
      skill({ error: "Missing name" }),
      skill({ source: "claude", path: `${ROOT}/.claude/skills/review/SKILL.md` }),
    ];
    const discovered = { ...AGENT, id: "cli:claude:helper", source: "claude" };
    const personal = { ...AGENT, id: "personal-1", scope: undefined };
    expect(cliSyncFiles(ROOT, ["claude"], skills, [discovered, personal])).toEqual([]);
  });

  it("resolves paths relative to the workspace root", () => {
    expect(relativeToRoot("/work/app/", "/work/app/.pragma/skills/a.md")).toBe(
      ".pragma/skills/a.md",
    );
    expect(relativeToRoot("C:\\work\\app", "C:\\work\\app\\.pragma\\agents\\a.md")).toBe(
      ".pragma/agents/a.md",
    );
    expect(relativeToRoot("/work/app", "/work/other/a.md")).toBeNull();
  });
});
