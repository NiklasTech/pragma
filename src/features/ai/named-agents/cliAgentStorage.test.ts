import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { withCliAgents } from "./cliAgentStorage";
import { loadProjectAgents } from "./projectStorage";

const agent = (name: string) => `---\nname: ${name}\ndescription: Helps.\n---\n\nDo the work.\n`;

let files: Map<string, string>;

beforeEach(() => {
  files = new Map();
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string, args: { path: string }) => {
    if (command === "list_directory") {
      const entries = [...files.keys()]
        .filter((path) => path.slice(0, path.lastIndexOf("/")) === args.path)
        .map((path) => ({ path, name: path.slice(args.path.length + 1), is_file: true }));
      if (entries.length === 0) throw new Error(`Not found: ${args.path}`);
      return entries;
    }
    if (command === "read_text_file") return { content: files.get(args.path) };
    throw new Error(`Unexpected command ${command}`);
  });
});

async function load() {
  return withCliAgents("/ws", await loadProjectAgents("/ws"));
}

describe("withCliAgents", () => {
  it("adds a Claude Code subagent as a read-only project agent", async () => {
    files.set("/ws/.claude/agents/reviewer.md", agent("Reviewer"));

    const { agents, issues } = await load();
    expect(issues).toEqual([]);
    expect(agents).toMatchObject([
      {
        id: "cli:claude:reviewer",
        name: "Reviewer",
        source: "claude",
        engine: { kind: "cli", cliProviderId: "anthropic-claude" },
      },
    ]);
  });

  it("lets .pragma win on equal ids and the first CLI folder win among CLI folders", async () => {
    files.set(
      "/ws/.pragma/agents/reviewer.md",
      `---\nname: Reviewer\nengine: builtin\n---\n\nBrief.\n`,
    );
    files.set("/ws/.claude/agents/reviewer.md", agent("Claude reviewer"));
    files.set("/ws/.claude/agents/tester.md", agent("Tester"));
    files.set("/ws/.cursor/agents/tester.md", agent("Cursor tester"));

    const { agents } = await load();
    expect(agents.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "project:reviewer", name: "Reviewer" },
      { id: "cli:claude:tester", name: "Tester" },
    ]);
  });

  it("lists malformed files and taken names as issues without dropping other agents", async () => {
    files.set(
      "/ws/.pragma/agents/review.md",
      `---\nname: Reviewer\nengine: builtin\n---\n\nBrief.\n`,
    );
    files.set("/ws/.gemini/agents/reviewer.md", agent("Reviewer"));
    files.set("/ws/.codex/agents/broken.toml", 'name = "broken"\n');
    files.set("/ws/.github/agents/audit.agent.md", agent("Audit"));

    const { agents, issues } = await load();
    expect(agents.map((item) => item.id)).toEqual(["cli:github:audit", "project:review"]);
    expect(issues).toEqual([
      {
        id: "cli:codex:broken",
        name: "broken",
        path: "/ws/.codex/agents/broken.toml",
        error: "Missing developer_instructions",
      },
      {
        id: "cli:gemini:reviewer",
        name: "Reviewer",
        path: "/ws/.gemini/agents/reviewer.md",
        error: "Another project agent has this name",
      },
    ]);
  });
});
