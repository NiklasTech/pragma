import { describe, expect, it } from "vite-plus/test";

import { fullestWindow, nearLimitWindow, shortWindowName } from "./nearLimit";
import type { SubscriptionUsage } from "./types";

const NOW = 1_000_000;

function usage(windows: Array<[string, number, number | null]>): SubscriptionUsage {
  return {
    providerId: "anthropic-claude",
    fetchedAtMs: NOW,
    windows: windows.map(([id, usedPercent, resetsAtMs]) => ({
      id,
      label: id,
      usedPercent,
      resetsAtMs,
    })),
  };
}

describe("nearLimitWindow", () => {
  it("picks the fullest window that has not reset", () => {
    const plan = usage([
      ["five_hour", 93, NOW + 1000],
      ["seven_day", 40, NOW + 9000],
      ["seven_day_opus", 99, NOW - 1],
    ]);
    expect(fullestWindow(plan, NOW)?.id).toBe("five_hour");
    expect(nearLimitWindow(plan, NOW)?.id).toBe("five_hour");
    expect(shortWindowName(nearLimitWindow(plan, NOW)!)).toBe("5h");
  });

  it("stays null while the account has room", () => {
    expect(nearLimitWindow(usage([["five_hour", 89, null]]), NOW)).toBeNull();
    expect(nearLimitWindow(usage([["five_hour", 89, null]]), NOW, 80)?.id).toBe("five_hour");
    expect(nearLimitWindow(null, NOW)).toBeNull();
  });
});
