import { describe, expect, it } from "vite-plus/test";

import { cliFolderLabel, isCliAgentPath, isCliSkillPath } from "./sources";

describe("CLI folder paths", () => {
  it("recognizes skill files in the CLI skill folders", () => {
    expect(isCliSkillPath("/ws/.claude/skills/pdf/SKILL.md")).toBe(true);
    expect(isCliSkillPath("C:\\ws\\.agents\\skills\\pdf\\scripts\\run.py")).toBe(true);
    expect(isCliSkillPath(".github/skills/x/SKILL.md")).toBe(true);
    expect(isCliSkillPath("/ws/.claude/agents/reviewer.md")).toBe(false);
    expect(isCliSkillPath("/ws/docs/skills/x.md")).toBe(false);
  });

  it("recognizes agent files in the CLI agent folders", () => {
    expect(isCliAgentPath("/ws/.claude/agents/reviewer.md")).toBe(true);
    expect(isCliAgentPath("/ws/.codex/agents/explorer.toml")).toBe(true);
    expect(isCliAgentPath("/ws/.github/agents/audit.agent.md")).toBe(true);
    expect(isCliAgentPath("/ws/.pragma/agents/reviewer.md")).toBe(false);
  });

  it("labels entries with their folder", () => {
    expect(cliFolderLabel("claude")).toBe(".claude");
    expect(cliFolderLabel("agents")).toBe(".agents");
    expect(cliFolderLabel("codex")).toBe(".codex");
  });
});
