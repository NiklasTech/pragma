import { describe, expect, it } from "vite-plus/test";

import type { CLIManifest } from "@/shared/stores/ai";

import { matchCliManifest } from "./foregroundCli";

function manifest(id: string, command: string): CLIManifest {
  return {
    id,
    name: id,
    description: "",
    install_cmd: "",
    command,
    supports_sessions: true,
    uses_acp: false,
    offers_terminal: true,
    native_rules_files: [],
  };
}

const MANIFESTS = [
  manifest("anthropic-claude", "claude"),
  manifest("openai-codex", "codex"),
  manifest("google-gemini", "gemini"),
];

describe("matchCliManifest", () => {
  it("knows a native CLI by its program name", () => {
    expect(matchCliManifest(["claude"], MANIFESTS)?.id).toBe("anthropic-claude");
  });

  it("knows a node CLI by its script", () => {
    expect(matchCliManifest(["node", "gemini", "hi"], MANIFESTS)?.id).toBe("google-gemini");
  });

  it("ignores Windows extensions and letter case", () => {
    expect(matchCliManifest(["Codex.exe"], MANIFESTS)?.id).toBe("openai-codex");
  });

  it("finds nothing for other programs", () => {
    expect(matchCliManifest(["vim", "notes.md"], MANIFESTS)).toBeNull();
  });
});
