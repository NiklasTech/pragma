import { describe, expect, it } from "vite-plus/test";

import type { CLIManifest } from "@/shared/stores/ai";
import type { CliAccount } from "@/shared/stores/ai/cliAccounts";

import { agentPane } from "./quickStart";
import { quickChoices, sameAgent } from "./quickChoices";

function manifest(id: string): CLIManifest {
  return {
    id,
    name: id,
    description: "",
    install_cmd: "",
    command: id,
    supports_sessions: true,
    uses_acp: false,
    offers_terminal: true,
    native_rules_files: [],
  };
}

function account(configDir: string | null, email: string | null, available = true): CliAccount {
  return {
    providerId: "anthropic-claude",
    configDir,
    email,
    displayName: null,
    organizationName: null,
    signedIn: true,
    available,
  };
}

const claude = manifest("anthropic-claude");
const codex = manifest("openai-codex");

describe("quickChoices", () => {
  it("offers a CLI once while it has one account", () => {
    const choices = quickChoices([claude, codex], [account(null, "a@x.test")], {});
    expect(choices.map((choice) => choice.accountLabel)).toEqual([null, null]);
    expect(choices[0].agent).toEqual({ kind: "cli", manifestId: "anthropic-claude" });
  });

  it("offers each usable account of a CLI as its own choice, named ones by name", () => {
    const accounts = [
      account(null, "a@x.test"),
      account("/h/.claude-work", "b@x.test"),
      account("/gone", null, false),
    ];
    const choices = quickChoices([claude, codex], accounts, {
      "anthropic-claude:/h/.claude-work": "work",
    });
    expect(choices.map((choice) => [choice.manifest.id, choice.accountLabel])).toEqual([
      ["anthropic-claude", "a@x.test"],
      ["anthropic-claude", "work"],
      ["openai-codex", null],
    ]);
    expect(choices[1].agent).toEqual({
      kind: "cli",
      manifestId: "anthropic-claude",
      accountDir: "/h/.claude-work",
    });
  });

  it("tells accounts of the same CLI apart", () => {
    const work = { kind: "cli", manifestId: "anthropic-claude", accountDir: "/w" } as const;
    expect(sameAgent(work, { kind: "cli", manifestId: "anthropic-claude" })).toBe(false);
    expect(sameAgent(work, { ...work })).toBe(true);
    expect(sameAgent({ kind: "terminal" }, { kind: "terminal" })).toBe(true);
  });

  it("puts the account into the pane a layout starts", () => {
    expect(agentPane({ kind: "cli", manifestId: "anthropic-claude", accountDir: "/w" })).toEqual({
      type: "pane",
      start: "cli",
      cliProviderId: "anthropic-claude",
      cliAccountDir: "/w",
    });
  });
});
