import { describe, expect, it } from "vite-plus/test";

import { groupThreadsByRecency } from "./helpers";

const NOW = new Date(2026, 8, 27, 15, 0, 0).getTime();
const HOUR = 60 * 60 * 1000;

function thread(id: string, updatedAt: number) {
  return { id, updatedAt };
}

describe("groupThreadsByRecency", () => {
  it("buckets threads by last activity and drops empty groups", () => {
    const groups = groupThreadsByRecency(
      [
        thread("today", NOW - HOUR),
        thread("yesterday", NOW - 20 * HOUR),
        thread("week", NOW - 4 * 24 * HOUR),
        thread("old", NOW - 30 * 24 * HOUR),
      ],
      () => false,
      NOW,
    );

    expect(groups.map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
      "Previous 7 days",
      "Older",
    ]);
    expect(groups.map((group) => group.items[0].id)).toEqual(["today", "yesterday", "week", "old"]);
  });

  it("pulls live threads into the Active group regardless of age", () => {
    const groups = groupThreadsByRecency(
      [thread("old-running", NOW - 30 * 24 * HOUR), thread("today", NOW - HOUR)],
      (item) => item.id === "old-running",
      NOW,
    );

    expect(groups[0]).toEqual({
      label: "Active",
      items: [thread("old-running", NOW - 30 * 24 * HOUR)],
    });
    expect(groups[1].label).toBe("Today");
  });
});
