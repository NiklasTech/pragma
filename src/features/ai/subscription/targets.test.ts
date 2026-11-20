import { describe, expect, it } from "vite-plus/test";

import type { CliAccount } from "@/shared/stores/ai/cliAccounts";

import { usageTargets } from "./targets";

function account(configDir: string | null): CliAccount {
  return {
    providerId: "anthropic-claude",
    configDir,
    email: null,
    displayName: null,
    organizationName: null,
    signedIn: true,
    available: true,
  };
}

describe("usageTargets", () => {
  it("shows one plan for a CLI with one account", () => {
    expect(usageTargets(["anthropic-claude"], [account(null)])).toEqual([
      { providerId: "anthropic-claude", configDir: null, account: null },
    ]);
  });

  it("shows a plan per account when a CLI has several", () => {
    const targets = usageTargets(["anthropic-claude"], [account(null), account("/w")]);
    expect(targets.map((target) => target.configDir)).toEqual([null, "/w"]);
  });
});
