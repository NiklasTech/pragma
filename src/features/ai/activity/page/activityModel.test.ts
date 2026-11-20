import { describe, expect, it } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";

import type { DashboardItem, DashboardState } from "../dashboard";
import {
  activitySections,
  filledCells,
  lastTerminalLine,
  matchesFilter,
  mostRoomKey,
  startOfDay,
} from "./activityModel";

const NOW = new Date(2026, 10, 20, 21, 0).getTime();

function item(id: string, state: DashboardState, since: number): DashboardItem {
  const session: ChatSession = {
    id,
    rootPath: "/repo",
    title: id,
    messages: [],
    createdAt: 0,
    updatedAt: 0,
  };
  return { session, state, since };
}

function window(usedPercent: number) {
  return { id: "five_hour", label: "Current session", usedPercent, resetsAtMs: null };
}

describe("activitySections", () => {
  it("puts questions first, then running work, then what ended today", () => {
    const yesterday = startOfDay(NOW) - 1000;
    const sections = activitySections(
      [
        item("ran", "working", NOW - 5000),
        item("asks-late", "waiting", NOW - 1000),
        item("asks-early", "waiting", NOW - 9000),
        item("done", "finished", NOW - 3000),
        item("failed", "failed", NOW - 2000),
        item("old", "finished", yesterday),
      ],
      NOW,
    );
    expect(sections.needs.map((entry) => entry.session.id)).toEqual(["asks-early", "asks-late"]);
    expect(sections.running.map((entry) => entry.session.id)).toEqual(["ran"]);
    expect(sections.earlier.map((entry) => entry.session.id)).toEqual(["failed", "done"]);
  });
});

describe("matchesFilter", () => {
  it("needs every word somewhere, ignoring case", () => {
    expect(matchesFilter(["Fix login", "claude code · work"], "login WORK")).toBe(true);
    expect(matchesFilter(["Fix login"], "login codex")).toBe(false);
    expect(matchesFilter(["anything"], "  ")).toBe(true);
  });
});

describe("mostRoomKey", () => {
  it("picks the plan whose fullest window is emptiest, once two plans report", () => {
    expect(
      mostRoomKey([
        { key: "work", windows: [window(74), window(59)] },
        { key: "personal", windows: [window(34), window(41)] },
        { key: "codex", windows: [] },
      ]),
    ).toBe("personal");
    expect(mostRoomKey([{ key: "only", windows: [window(10)] }])).toBeNull();
  });
});

describe("filledCells", () => {
  it("rounds to cells and stays in range", () => {
    expect(filledCells(34)).toBe(7);
    expect(filledCells(0)).toBe(0);
    expect(filledCells(140)).toBe(20);
  });
});

describe("lastTerminalLine", () => {
  it("shows the last printed line without colors or overwritten progress", () => {
    const buffer = "\u001b[32mok\u001b[0m\r\nbuilding 10%\rbuilding 100%\r\n\r\n";
    expect(lastTerminalLine(buffer)).toBe("building 100%");
    expect(lastTerminalLine("")).toBe("");
  });
});
