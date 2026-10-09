import { describe, expect, it } from "vite-plus/test";

import { describeSchedule, nextRunAt, parseTime } from "./schedule";

const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();

describe("task schedules", () => {
  it("runs daily at the next future local time", () => {
    const daily = { frequency: "daily", hour: 9, minute: 30 } as const;
    expect(nextRunAt(daily, at(9, 8))).toBe(at(9, 9, 30));
    expect(nextRunAt(daily, at(9, 9, 30))).toBe(at(10, 9, 30));
    expect(nextRunAt(daily, at(9, 22))).toBe(at(10, 9, 30));
  });

  it("runs weekly on the chosen weekday without catching up", () => {
    // October 9, 2026 is a Friday.
    const monday = { frequency: "weekly", hour: 8, minute: 0, weekday: 1 } as const;
    expect(nextRunAt(monday, at(9, 12))).toBe(at(12, 8));
    const friday = { frequency: "weekly", hour: 8, minute: 0, weekday: 5 } as const;
    expect(nextRunAt(friday, at(9, 7))).toBe(at(9, 8));
    expect(nextRunAt(friday, at(9, 8))).toBe(at(16, 8));
  });

  it("describes and parses times", () => {
    expect(describeSchedule({ frequency: "daily", hour: 7, minute: 5 })).toBe("Daily at 07:05");
    expect(describeSchedule({ frequency: "weekly", hour: 18, minute: 0, weekday: 3 })).toBe(
      "Wednesday at 18:00",
    );
    expect(parseTime("09:45")).toEqual({ hour: 9, minute: 45 });
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("9:45")).toBeNull();
  });
});
