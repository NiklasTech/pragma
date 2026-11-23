import { describe, expect, it } from "vite-plus/test";

import type { CliAccount } from "@/shared/stores/ai/cliAccounts";

import type { SubscriptionUsage } from "../subscription/types";
import { otherAccounts, windowKey } from "./options";

const NOW = 1_000_000;

function account(configDir: string | null, email: string, extra?: Partial<CliAccount>): CliAccount {
  return {
    providerId: "anthropic-claude",
    configDir,
    email,
    displayName: null,
    organizationName: null,
    signedIn: true,
    available: true,
    ...extra,
  };
}

function usage(percent: number): SubscriptionUsage {
  return {
    providerId: "anthropic-claude",
    fetchedAtMs: NOW,
    windows: [
      { id: "five_hour", label: "Current session", usedPercent: percent, resetsAtMs: NOW + 1 },
    ],
  };
}

describe("otherAccounts", () => {
  it("lists the other signed-in accounts of the CLI, most room first", () => {
    const accounts = [
      account(null, "me@home"),
      account("/h/.claude-work", "me@work"),
      account("/h/.claude-team", "me@team"),
      account("/h/.claude-old", "old", { signedIn: false }),
      account("/h/.codex-x", "codex", { providerId: "openai-codex" }),
    ];
    const percent: Record<string, number> = { "/h/.claude-work": 60, "/h/.claude-team": 14 };
    const options = otherAccounts(
      accounts,
      "anthropic-claude",
      null,
      (item) => (item.configDir ? usage(percent[item.configDir] ?? 0) : null),
      { "anthropic-claude:/h/.claude-team": "team" },
      NOW,
    );
    expect(options.map((option) => option.label)).toEqual(["team", "me@work"]);
    expect(options[0]?.fullest?.usedPercent).toBe(14);
  });

  it("leaves out the session's own account", () => {
    const accounts = [account(null, "me@home"), account("/h/.claude-work", "me@work")];
    const options = otherAccounts(
      accounts,
      "anthropic-claude",
      "/h/.claude-work",
      () => null,
      {},
      NOW,
    );
    expect(options.map((option) => option.label)).toEqual(["me@home"]);
  });
});

describe("windowKey", () => {
  it("names a window by id and reset, and the plain limit otherwise", () => {
    expect(windowKey({ id: "five_hour", label: "x", usedPercent: 91, resetsAtMs: 5 })).toBe(
      "five_hour:5",
    );
    expect(windowKey(null)).toBe("limit");
  });
});
