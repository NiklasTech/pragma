import { describe, expect, it } from "vite-plus/test";

import type { ChatSession, SessionUsage } from "@/shared/stores/ai";

import type { DashboardState } from "../activity/dashboard";
import {
  combineByProvider,
  currentWindows,
  formatResetIn,
  formatUpdatedAgo,
  headlineWindow,
  isStale,
  sessionCliProvider,
  sessionTokens,
  STALE_AFTER_MS,
  usageLevel,
} from "./summary";
import type { SubscriptionUsage } from "./types";

const NOW = 10_000_000;

function usage(
  windows: SubscriptionUsage["windows"],
  fetchedAtMs: number | null = NOW,
): SubscriptionUsage {
  return { providerId: "anthropic-claude", windows, fetchedAtMs };
}

const session5h = {
  id: "five_hour",
  label: "Current session",
  usedPercent: 54,
  resetsAtMs: NOW + 3_600_000,
};
const week = {
  id: "seven_day",
  label: "Current week",
  usedPercent: 81,
  resetsAtMs: NOW + 86_400_000,
};

function tokens(inputTokens: number, outputTokens: number): SessionUsage {
  return { inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0, responses: 1 };
}

function item(state: DashboardState, extra: Partial<ChatSession>) {
  return {
    state,
    session: { id: "s", title: "s", messages: [], createdAt: 0, updatedAt: 0, ...extra },
  };
}

describe("currentWindows", () => {
  it("drops windows whose reset has passed", () => {
    const expired = { ...session5h, resetsAtMs: NOW - 1 };
    expect(currentWindows(usage([expired, week]), NOW)).toEqual([week]);
  });

  it("keeps windows without a reset time", () => {
    const open = { ...week, resetsAtMs: null };
    expect(currentWindows(usage([open]), NOW)).toEqual([open]);
  });

  it("is empty without usage", () => {
    expect(currentWindows(null, NOW)).toEqual([]);
  });
});

describe("headlineWindow", () => {
  it("picks the window closest to its limit", () => {
    expect(headlineWindow(usage([session5h, week]), NOW)).toBe(week);
  });

  it("is null when nothing is current", () => {
    expect(headlineWindow(usage([]), NOW)).toBeNull();
  });
});

describe("isStale", () => {
  it("is stale without values or after the stale age", () => {
    expect(isStale(null, NOW)).toBe(true);
    expect(isStale(usage([session5h], null), NOW)).toBe(true);
    expect(isStale(usage([session5h], NOW - STALE_AFTER_MS), NOW)).toBe(true);
  });

  it("is stale once a window has reset", () => {
    expect(isStale(usage([{ ...session5h, resetsAtMs: NOW - 1 }]), NOW)).toBe(true);
  });

  it("is fresh right after a fetch", () => {
    expect(isStale(usage([session5h, week], NOW - 60_000), NOW)).toBe(false);
  });
});

describe("formatting", () => {
  it("formats the reset and update times", () => {
    expect(formatResetIn(NOW + 4_800_000, NOW)).toBe("resets in 1h 20m");
    expect(formatResetIn(null, NOW)).toBeNull();
    expect(formatUpdatedAgo(NOW - 120_000, NOW)).toBe("Updated 2m ago");
    expect(formatUpdatedAgo(null, NOW)).toBe("Not loaded yet");
  });

  it("raises the level near the limit", () => {
    expect(usageLevel(74)).toBe("normal");
    expect(usageLevel(75)).toBe("high");
    expect(usageLevel(90)).toBe("critical");
  });
});

describe("sessionCliProvider", () => {
  it("reads the terminal CLI or the pinned CLI engine", () => {
    expect(sessionCliProvider({ cliProviderId: "anthropic-claude" })).toBe("anthropic-claude");
    expect(
      sessionCliProvider({ agentEngine: { kind: "cli", cliProviderId: "openai-codex" } }),
    ).toBe("openai-codex");
    expect(
      sessionCliProvider({ agentEngine: { kind: "builtin", provider: "anthropic" } }),
    ).toBeNull();
  });
});

describe("sessionTokens", () => {
  it("adds input and output, or is null when nothing was reported", () => {
    expect(sessionTokens({ usage: tokens(1000, 200) })).toBe(1200);
    expect(sessionTokens({ usage: { ...tokens(0, 0), responses: 0 } })).toBeNull();
    expect(sessionTokens({})).toBeNull();
  });
});

describe("combineByProvider", () => {
  it("adds up the sessions of each CLI and counts those without token counts", () => {
    const combined = combineByProvider([
      item("working", { cliProviderId: "anthropic-claude", usage: tokens(1000, 100) }),
      item("idle", { cliProviderId: "anthropic-claude", usage: tokens(500, 50) }),
      item("working", { cliProviderId: "anthropic-claude", kind: "terminal" }),
      item("working", { agentEngine: { kind: "cli", cliProviderId: "openai-codex" } }),
      item("working", { agentEngine: { kind: "builtin", provider: "anthropic" } }),
    ]);

    expect(combined).toEqual([
      { providerId: "anthropic-claude", sessions: 3, working: 2, tokens: 1650, unreported: 1 },
      { providerId: "openai-codex", sessions: 1, working: 1, tokens: 0, unreported: 1 },
    ]);
  });
});
