import { describe, expect, it } from "vite-plus/test";

import {
  isProjectAgentPath,
  newProjectFileId,
  parseProjectAgent,
  projectAgentFileId,
  relativeAgentFolders,
  serializeProjectAgent,
  type ProjectAgentParse,
} from "./projectFile";

const ROOT = "/ws";

function file(frontMatter: string, body = "Review the diff before a pull request."): string {
  return `---\n${frontMatter}\n---\n\n${body}\n`;
}

function parse(content: string, fileId = "reviewer"): ProjectAgentParse {
  return parseProjectAgent(fileId, `${ROOT}/.pragma/agents/${fileId}.md`, content, ROOT, 5);
}

function errorOf(content: string, fileId?: string): string | null {
  const result = parse(content, fileId);
  return result.ok ? null : result.issue.error;
}

describe("parseProjectAgent", () => {
  it("maps the front matter to the agent and the body to the brief", () => {
    const result = parse(
      file(
        [
          "name: Reviewer",
          "description: Reviews changes.",
          "engine: builtin",
          "provider: anthropic",
          "model: claude-sonnet-5-5",
          "skills: [release, add-migration]",
          "mcpServers: [docs]",
          "folders: [docs, src/lib]",
        ].join("\n"),
      ),
    );
    expect(result).toEqual({
      ok: true,
      agent: {
        id: "project:reviewer",
        name: "Reviewer",
        description: "Reviews changes.",
        brief: "Review the diff before a pull request.",
        engine: { kind: "builtin", provider: "anthropic", model: "claude-sonnet-5-5" },
        folders: ["/ws/docs", "/ws/src/lib"],
        memory: [],
        skills: ["release", "add-migration"],
        mcpServers: ["docs"],
        scope: "project",
        createdAt: 5,
        updatedAt: 5,
      },
    });
  });

  it("reads a CLI engine from the cli field", () => {
    const result = parse(file("name: Reviewer\nengine: cli\ncli: anthropic-claude"));
    expect(result.ok && result.agent.engine).toEqual({
      kind: "cli",
      cliProviderId: "anthropic-claude",
    });
  });

  it("leaves skills, folders and MCP servers at their defaults when absent", () => {
    const result = parse(file("name: Reviewer\nengine: builtin"));
    expect(result.ok && result.agent).toMatchObject({ skills: [], folders: [], memory: [] });
    expect(result.ok && result.agent.mcpServers).toBeUndefined();
  });

  it("rejects an invalid engine", () => {
    expect(errorOf(file("name: Reviewer"))).toBe("engine must be builtin or cli");
    expect(errorOf(file("name: Reviewer\nengine: gpt"))).toBe("engine must be builtin or cli");
    expect(errorOf(file("name: Reviewer\nengine: cli"))).toBe("cli is required when engine is cli");
    expect(errorOf(file("name: Reviewer\nengine: builtin\nprovider: nope"))).toBe(
      "provider is not a known provider",
    );
  });

  it("rejects a base URL because it is machine specific", () => {
    expect(errorOf(file("name: Reviewer\nengine: builtin\nbaseUrl: http://localhost:1234"))).toBe(
      "baseUrl is not allowed in project agents",
    );
  });

  it("rejects absolute folders and folders leaving the workspace", () => {
    const withFolder = (folder: string) =>
      errorOf(file(`name: Reviewer\nengine: builtin\nfolders: ["${folder}"]`));
    expect(withFolder("/etc")).toBe("Folder /etc must be relative to the workspace");
    expect(withFolder("C:\\\\Users")).toBe("Folder C:\\Users must be relative to the workspace");
    expect(withFolder("~/notes")).toBe("Folder ~/notes must be relative to the workspace");
    expect(withFolder("../other")).toBe("Folder ../other leaves the workspace");
    expect(withFolder("docs/../../other")).toBe("Folder docs/../../other leaves the workspace");
    expect(withFolder("docs/../src")).toBeNull();
  });

  it("rejects secrets anywhere in the file", () => {
    expect(
      errorOf(file("name: Reviewer\nengine: builtin", "Use sk-ant-abcdefgh1234 for calls.")),
    ).toBe("Do not store secrets in agent files");
    expect(errorOf(file("name: Reviewer\nengine: builtin", "Send Bearer abcdefgh12345678."))).toBe(
      "Do not store secrets in agent files",
    );
    expect(
      errorOf(file("name: Reviewer\nengine: builtin", "Keep the task-list and disk-usage low.")),
    ).toBeNull();
  });

  it("reports missing parts and invalid file names", () => {
    expect(errorOf("Just a brief.")).toBe("Missing front matter");
    expect(errorOf(file("engine: builtin"))).toBe("Missing name");
    expect(errorOf(file("name: Reviewer\nengine: builtin", ""))).toBe(
      "Missing brief below the front matter",
    );
    expect(errorOf(file("name: [unclosed"))).toBe("Front matter is not valid YAML");
    expect(errorOf(file("name: Reviewer\nengine: builtin\nskills: [a/b]"))).toBe(
      "skills must be a list of skill ids",
    );
    expect(errorOf(file("name: Reviewer\nengine: builtin"), "my agent")).toBe(
      "File name may only use letters, digits, - and _",
    );
  });

  it("names the issue after the agent once the name is known", () => {
    const result = parse(file("name: Reviewer\nengine: gpt"));
    expect(result.ok ? null : result.issue).toEqual({
      id: "project:reviewer",
      path: "/ws/.pragma/agents/reviewer.md",
      name: "Reviewer",
      error: "engine must be builtin or cli",
    });
  });
});

describe("serializeProjectAgent", () => {
  it("round-trips through the parser without the base URL", () => {
    const parsed = parse(
      file(
        "name: 'Reviewer: strict'\ndescription: Reviews changes.\nengine: builtin\nprovider: anthropic\nmodel: m\nskills: [release]\nmcpServers: []\nfolders: [docs]",
      ),
    );
    if (!parsed.ok) throw new Error(parsed.issue.error);
    const agent = { ...parsed.agent, engine: { ...parsed.agent.engine, baseUrl: "http://x" } };

    const content = serializeProjectAgent(agent, ["docs"]);
    expect(content).toBe(
      [
        "---",
        'name: "Reviewer: strict"',
        "description: Reviews changes.",
        "engine: builtin",
        "provider: anthropic",
        "model: m",
        "skills: [ release ]",
        "mcpServers: []",
        "folders: [ docs ]",
        "---",
        "",
        "Review the diff before a pull request.",
        "",
      ].join("\n"),
    );
    expect(parse(content)).toEqual(parsed);
  });

  it("writes the CLI id for a CLI engine", () => {
    const parsed = parse(file("name: Reviewer\nengine: cli\ncli: anthropic-claude"));
    if (!parsed.ok) throw new Error(parsed.issue.error);
    expect(serializeProjectAgent(parsed.agent, [])).toContain(
      "engine: cli\ncli: anthropic-claude\n",
    );
  });
});

describe("project agent paths and ids", () => {
  it("detects agent files", () => {
    expect(isProjectAgentPath("/ws/.pragma/agents/reviewer.md")).toBe(true);
    expect(isProjectAgentPath("C:\\ws\\.pragma\\agents\\reviewer.md")).toBe(true);
    expect(isProjectAgentPath("/ws/.pragma/agents/notes.txt")).toBe(false);
    expect(isProjectAgentPath("/ws/.pragma/skills/reviewer.md")).toBe(false);
  });

  it("maps agent ids to file ids", () => {
    expect(projectAgentFileId("project:reviewer")).toBe("reviewer");
    expect(projectAgentFileId("3f2c")).toBeNull();
  });

  it("derives a free file id from the name", () => {
    expect(newProjectFileId("Code Reviewer!", [])).toBe("code-reviewer");
    expect(newProjectFileId("Reviewer", ["reviewer", "reviewer-2"])).toBe("reviewer-3");
    expect(newProjectFileId("!!!", [])).toBe("agent");
  });

  it("splits folders into workspace-relative and outside paths", () => {
    expect(relativeAgentFolders("/ws", ["/ws/docs", "/ws", "/elsewhere", "/ws-other"])).toEqual({
      relative: ["docs"],
      outside: ["/elsewhere", "/ws-other"],
    });
  });
});
