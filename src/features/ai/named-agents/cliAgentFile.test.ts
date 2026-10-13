import { describe, expect, it } from "vite-plus/test";

import { CLI_AGENT_FOLDERS, type CliAgentFolder } from "@/features/ai/cli-folders/sources";

import { cliAgentFileId, cliAgentFileIdFromName, parseCliAgent } from "./cliAgentFile";

function folder(id: string): CliAgentFolder {
  const found = CLI_AGENT_FOLDERS.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown folder ${id}`);
  return found;
}

const CLAUDE = `---
name: code-reviewer
description: Reviews code for quality
  and best practices.
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer.
`;

const CODEX = `name = "pr_explorer"
description = "Read-only codebase explorer."
model = "gpt-6-luna"
sandbox_mode = "read-only"
developer_instructions = """
Stay in exploration mode.
"""
`;

describe("parseCliAgent", () => {
  it("maps a Claude Code subagent and ignores tool-specific fields", () => {
    const result = parseCliAgent(folder("claude"), "code-reviewer", "/p", CLAUDE, 1);
    expect(result).toEqual({
      ok: true,
      agent: {
        id: "cli:claude:code-reviewer",
        name: "code-reviewer",
        description: "Reviews code for quality and best practices.",
        brief: "You are a code reviewer.",
        engine: { kind: "cli", cliProviderId: "anthropic-claude" },
        folders: [],
        memory: [],
        skills: [],
        scope: "project",
        source: "claude",
        createdAt: 1,
        updatedAt: 1,
      },
    });
  });

  it("maps a Codex TOML agent", () => {
    const result = parseCliAgent(folder("codex"), "pr-explorer", "/p", CODEX);
    expect(result.ok && result.agent).toMatchObject({
      id: "cli:codex:pr-explorer",
      name: "pr_explorer",
      description: "Read-only codebase explorer.",
      brief: "Stay in exploration mode.",
      engine: { kind: "cli", cliProviderId: "openai-codex" },
    });
  });

  it("falls back to the file name without a name or front matter", () => {
    const result = parseCliAgent(folder("cursor"), "helper", "/p", "Just a prompt.\n");
    expect(result.ok && result.agent).toMatchObject({ name: "helper", brief: "Just a prompt." });
  });

  it("reports malformed files", () => {
    const issue = (id: string, content: string) => {
      const result = parseCliAgent(folder(id), "x", "/p/x", content);
      return result.ok ? null : result.issue.error;
    };
    expect(issue("claude", "---\nname: [a\n---\nBody")).toBe("Front matter is not valid YAML");
    expect(issue("claude", "---\nname: x\n---\n")).toBe(
      "Missing instructions below the front matter",
    );
    expect(issue("claude", "---\nname: 3\n---\nBody")).toBe("name must be text");
    expect(issue("codex", 'name = "x"\n')).toBe("Missing developer_instructions");
    expect(issue("codex", "name = \n")).toBe("File is not valid TOML");
    expect(issue("gemini", `---\nname: ${"n".repeat(41)}\n---\nBody`)).toMatch(/Name must be/);
  });
});

describe("CLI agent ids", () => {
  it("strips the file ending of the folder", () => {
    expect(cliAgentFileIdFromName(folder("github"), "audit.agent.md")).toBe("audit");
    expect(cliAgentFileIdFromName(folder("github"), "audit.md")).toBe("audit");
    expect(cliAgentFileIdFromName(folder("codex"), "explorer.toml")).toBe("explorer");
    expect(cliAgentFileIdFromName(folder("codex"), "notes.md")).toBeNull();
  });

  it("reads the file id back from the agent id", () => {
    expect(cliAgentFileId("cli:claude:code-reviewer")).toBe("code-reviewer");
    expect(cliAgentFileId("project:code-reviewer")).toBeNull();
  });
});
