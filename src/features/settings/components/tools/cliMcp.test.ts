import { describe, expect, it } from "vite-plus/test";

import type { McpServerConfig } from "@/shared/stores/settings";

import { mcpUsage, newCandidates, visibleClis, type McpImportCandidate } from "./cliMcp";
import { mcpRowState } from "./mcpRowState";

function candidate(name: string, source: string, cli?: McpImportCandidate["cli"]) {
  const server: McpServerConfig = {
    id: "",
    name,
    transport: "stdio",
    command: "node",
    args: [],
    env: {},
    secretEnv: [],
    headers: {},
    secretHeaders: [],
    autostart: false,
  };
  return { source, cli, server };
}

describe("mcpUsage", () => {
  it("names the first file per CLI for each server", () => {
    const usage = mcpUsage([
      candidate("github", ".mcp.json", "claude"),
      candidate("github", "~/.claude.json", "claude"),
      candidate("github", "~/.codex/config.toml", "codex"),
      candidate("desktop", "Claude Desktop"),
    ]);
    expect(usage).toEqual({
      github: { claude: ".mcp.json", codex: "~/.codex/config.toml" },
    });
  });
});

describe("visibleClis", () => {
  it("shows installed CLIs and those that list a server, in a fixed order", () => {
    const usage = { linear: { gemini: "~/.gemini/settings.json" } };
    const clis = visibleClis(new Set(["openai-codex", "anthropic-claude"]), usage);
    expect(clis.map((info) => info.cli)).toEqual(["claude", "codex", "gemini"]);
  });
});

describe("newCandidates", () => {
  it("skips names Pragma has and repeats", () => {
    const picked = newCandidates(
      [
        candidate("a", ".mcp.json", "claude"),
        candidate("b", "~/.codex/config.toml", "codex"),
        candidate("b", "~/.gemini/settings.json", "gemini"),
      ],
      ["a"],
    );
    expect(picked.map((c) => `${c.server.name}@${c.source}`)).toEqual(["b@~/.codex/config.toml"]);
  });
});

describe("mcpRowState", () => {
  it("puts a sign-in request before the error it came with", () => {
    expect(mcpRowState("error", true, false).kind).toBe("sign-in");
    expect(mcpRowState("error", false, false)).toEqual({
      kind: "failed",
      word: "failed",
      cell: "failed",
    });
  });

  it("asks for missing secrets only while stopped", () => {
    expect(mcpRowState("stopped", false, true).word).toBe("needs secrets");
    expect(mcpRowState("running", false, true).kind).toBe("running");
    expect(mcpRowState("starting", false, false).cell).toBe("working");
  });
});
