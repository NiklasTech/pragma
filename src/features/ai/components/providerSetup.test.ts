import { describe, expect, it } from "vite-plus/test";

import type { AIProvider, CLIManifest, CLIStatus } from "@/shared/stores/ai";

import { providerSetup, type ProviderSetupInput } from "./providerSetup";

const manifest = (id: string): CLIManifest => ({
  id,
  name: id === "anthropic-claude" ? "Claude Code" : "OpenAI Codex",
  description: "",
  install_cmd: "",
  command: "",
  supports_sessions: true,
  uses_acp: true,
  offers_terminal: true,
  native_rules_files: [],
});

const status = (provider_id: string, authenticated: boolean): CLIStatus => ({
  provider_id,
  installed: true,
  version: "1.0.0",
  authenticated,
  user: null,
  error: null,
});

const noKeys = { openai: null, anthropic: null } as Record<AIProvider, string | null>;

const base: ProviderSetupInput = {
  canChat: false,
  cliStatusesLoaded: true,
  cliStatuses: {},
  cliManifests: [manifest("openai-codex"), manifest("anthropic-claude")],
  activeCLIProvider: null,
  apiKeyRefs: noKeys,
  copilotAuthenticated: false,
  customBaseUrl: undefined,
};

describe("providerSetup", () => {
  it("says nothing while the chat can answer or the CLIs are still checked", () => {
    expect(providerSetup({ ...base, canChat: true })).toEqual({ kind: "ready" });
    expect(providerSetup({ ...base, cliStatusesLoaded: false })).toEqual({ kind: "checking" });
  });

  it("asks to set something up only when nothing is", () => {
    expect(providerSetup(base)).toEqual({ kind: "nothing" });
    const signedOut = { "anthropic-claude": status("anthropic-claude", false) };
    expect(providerSetup({ ...base, cliStatuses: signedOut })).toEqual({ kind: "nothing" });
  });

  it("offers a signed-in CLI, preferring the selected one, when this chat's engine is not set up", () => {
    const cliStatuses = {
      "openai-codex": status("openai-codex", true),
      "anthropic-claude": status("anthropic-claude", true),
    };
    expect(providerSetup({ ...base, cliStatuses })).toMatchObject({
      kind: "otherEngine",
      cli: { id: "openai-codex" },
    });
    expect(
      providerSetup({ ...base, cliStatuses, activeCLIProvider: "anthropic-claude" }),
    ).toMatchObject({ kind: "otherEngine", cli: { id: "anthropic-claude" } });
  });

  it("counts an API key as set up, without a CLI to offer", () => {
    const apiKeyRefs = { ...noKeys, anthropic: "sk-...abcd" };
    expect(providerSetup({ ...base, apiKeyRefs })).toEqual({ kind: "otherEngine", cli: null });
  });
});
