import { describe, expect, it } from "vite-plus/test";
import { formatStashDate } from "./stashFormat";

const NOW = Date.UTC(2024, 0, 10, 12, 0, 0);

describe("formatStashDate", () => {
  it("returns empty for missing timestamps", () => {
    expect(formatStashDate(0, NOW)).toBe("");
  });

  it("formats recent timestamps relative to now", () => {
    expect(formatStashDate(NOW / 1000 - 10, NOW)).toBe("just now");
    expect(formatStashDate(NOW / 1000 - 5 * 60, NOW)).toBe("5m ago");
    expect(formatStashDate(NOW / 1000 - 3 * 3600, NOW)).toBe("3h ago");
    expect(formatStashDate(NOW / 1000 - 2 * 86400, NOW)).toBe("2d ago");
  });

  it("falls back to an absolute date for older timestamps", () => {
    const formatted = formatStashDate(NOW / 1000 - 30 * 86400, NOW);
    expect(formatted).not.toContain("ago");
    expect(formatted.length).toBeGreaterThan(0);
  });
});
