import { describe, expect, it } from "vite-plus/test";

import { MAX_PANES } from "../panes/operations";
import { pickOnly, setMemberCount, teamTotal, toggleMember, type TeamMember } from "./agentTeam";

const claude = { kind: "cli", manifestId: "claude" } as const;
const work = { kind: "cli", manifestId: "claude", accountDir: "/work" } as const;
const codex = { kind: "cli", manifestId: "codex" } as const;

describe("agent team", () => {
  it("switches to one agent and keeps the count of the one it replaces", () => {
    expect(pickOnly([{ agent: claude, count: 8 }], codex)).toEqual([{ agent: codex, count: 8 }]);
    expect(
      pickOnly(
        [
          { agent: claude, count: 2 },
          { agent: codex, count: 3 },
        ],
        codex,
      ),
    ).toEqual([{ agent: codex, count: 3 }]);
  });

  it("adds an agent with ⌘-click and takes it out again, but never the last one", () => {
    const mixed = toggleMember([{ agent: claude, count: 2 }], work);
    expect(mixed).toEqual([
      { agent: claude, count: 2 },
      { agent: work, count: 1 },
    ]);
    expect(toggleMember(mixed, work)).toEqual([{ agent: claude, count: 2 }]);
    expect(toggleMember([{ agent: claude, count: 2 }], claude)).toEqual([
      { agent: claude, count: 2 },
    ]);
  });

  it("keeps the whole start within the panes of a tab", () => {
    const full: TeamMember[] = [
      { agent: claude, count: MAX_PANES - 2 },
      { agent: codex, count: 2 },
    ];
    expect(toggleMember(full, work)).toEqual(full);
    expect(teamTotal(setMemberCount(full, codex, 5))).toBe(MAX_PANES);
  });

  it("takes an agent out when its count drops to zero while others stay", () => {
    const mixed: TeamMember[] = [
      { agent: claude, count: 2 },
      { agent: codex, count: 1 },
    ];
    expect(setMemberCount(mixed, codex, 0)).toEqual([{ agent: claude, count: 2 }]);
    expect(setMemberCount([{ agent: claude, count: 1 }], claude, 0)).toEqual([
      { agent: claude, count: 1 },
    ]);
  });
});
