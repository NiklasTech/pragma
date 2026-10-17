import { describe, expect, it } from "vite-plus/test";

import { parseAgentMarkdown } from "./markdownImport";
import type { Agent, AgentEngine } from "./types";

const ENGINE: AgentEngine = { kind: "builtin", provider: "anthropic", model: "m" };

function existing(name: string): Agent {
  return {
    id: "a1",
    name,
    brief: "Brief",
    engine: ENGINE,
    folders: [],
    memory: [],
    skills: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("Markdown agent import", () => {
  it("reads the .pragma/agents format as a personal agent without folders", () => {
    const text = [
      "---",
      "name: Reviewer",
      "description: Reviews changes.",
      "engine: cli",
      "cli: anthropic-claude",
      "skills: [release]",
      "folders: [docs, src]",
      "---",
      "",
      "Review the diff.",
    ].join("\n");
    const parsed = parseAgentMarkdown(text, "reviewer.md", [], ENGINE, 5);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.droppedFolders).toBe(2);
    expect(parsed.agent).toMatchObject({
      name: "Reviewer",
      description: "Reviews changes.",
      brief: "Review the diff.",
      engine: { kind: "cli", cliProviderId: "anthropic-claude" },
      skills: ["release"],
      folders: [],
      createdAt: 5,
    });
    expect(parsed.agent.scope).toBeUndefined();
  });

  it("reports errors of the .pragma/agents format", () => {
    const text = "---\nname: Reviewer\nengine: other\n---\n\nReview.";
    expect(parseAgentMarkdown(text, "reviewer.md", [], ENGINE)).toEqual({
      ok: false,
      error: "engine must be builtin or cli",
    });
  });

  it("reads a coding CLI subagent on the given engine and ignores its tool fields", () => {
    const text = [
      "---",
      "name: code-reviewer",
      "description: |",
      "  Reviews code",
      "  after changes.",
      "tools: Read, Grep",
      "model: sonnet",
      "---",
      "",
      "You review code.",
    ].join("\n");
    const parsed = parseAgentMarkdown(text, "code-reviewer.md", [], ENGINE);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.agent).toMatchObject({
      name: "code-reviewer",
      description: "Reviews code after changes.",
      brief: "You review code.",
      engine: ENGINE,
      skills: [],
      folders: [],
    });
  });

  it("names an agent without a name after its file", () => {
    const parsed = parseAgentMarkdown("You write tests.", "test-writer.agent.md", [], ENGINE);
    expect(parsed.ok && parsed.agent.name).toBe("test-writer");
  });

  it("numbers a name that is taken", () => {
    const text = "---\nname: Reviewer\n---\n\nReview.";
    const parsed = parseAgentMarkdown(text, "r.md", [existing("Reviewer")], ENGINE);
    expect(parsed.ok && parsed.agent.name).toBe("Reviewer 2");
  });

  it("rejects missing instructions, invalid YAML and secrets", () => {
    expect(parseAgentMarkdown("---\nname: A\n---\n", "a.md", [], ENGINE).ok).toBe(false);
    expect(parseAgentMarkdown("---\nname: [\n---\n\nBrief", "a.md", [], ENGINE).ok).toBe(false);
    const secret = "---\nname: A\n---\n\nUse sk-abcdefghijklmnop as the key.";
    expect(parseAgentMarkdown(secret, "a.md", [], ENGINE)).toEqual({
      ok: false,
      error: "The file contains something that looks like a secret",
    });
  });
});
