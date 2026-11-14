import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { agentIdentity, KNOWN_AGENT_IDS } from "./agentIdentity";

const manifest = readFileSync(join(process.cwd(), "src-tauri/src/ai/cli/manifest.rs"), "utf8");
const manifestIds = [...manifest.matchAll(/id: "([^"]+)"\.to_string\(\)/g)].map(
  (match) => match[1],
);

describe("agentIdentity", () => {
  it("gives every CLI in the manifest its own mark", () => {
    expect(manifestIds.length).toBeGreaterThan(0);
    expect([...KNOWN_AGENT_IDS].sort()).toEqual([...manifestIds].sort());
  });

  it("uses a different letter for every CLI", () => {
    const letters = KNOWN_AGENT_IDS.map((id) => agentIdentity(id, id).letter);
    expect(new Set(letters).size).toBe(letters.length);
  });

  it("colors the four main agents and keeps the rest neutral", () => {
    expect(agentIdentity("anthropic-claude", "Claude Code").color).toBe("claude");
    expect(agentIdentity("openai-codex", "OpenAI Codex").color).toBe("codex");
    expect(agentIdentity("google-gemini", "Gemini CLI").color).toBe("gemini");
    expect(agentIdentity("opencode", "OpenCode").color).toBe("opencode");
    expect(agentIdentity("xai-grok", "Grok Build").color).toBe("other");
  });

  it("falls back to the first letter of the name for unknown CLIs", () => {
    expect(agentIdentity("acme-agent", "acme agent")).toEqual({ letter: "A", color: "other" });
    expect(agentIdentity(undefined, "  ")).toEqual({ letter: "?", color: "other" });
  });
});
