import { describe, expect, it } from "vite-plus/test";

import { matchingCommands, planProgress, resumeSessionId, type AcpCommand } from "./sessionInfo";

function command(name: string): AcpCommand {
  return { name, description: `${name} description`, hint: null };
}

describe("matchingCommands", () => {
  const commands = [command("pr-review"), command("review"), command("compact")];

  it("puts commands that start with the query first", () => {
    expect(matchingCommands(commands, "review").map((item) => item.name)).toEqual([
      "review",
      "pr-review",
    ]);
  });

  it("keeps every command for an empty query", () => {
    expect(matchingCommands(commands, "")).toHaveLength(3);
  });
});

describe("planProgress", () => {
  it("counts completed entries", () => {
    expect(
      planProgress([
        { content: "a", priority: "high", status: "completed" },
        { content: "b", priority: "medium", status: "in_progress" },
        { content: "c", priority: "low", status: "pending" },
      ]),
    ).toEqual({ done: 1, total: 3 });
  });
});

describe("resumeSessionId", () => {
  it("continues the stored conversation of a chat, never of a terminal", () => {
    expect(resumeSessionId({ kind: "agent", cliSessionId: "abc" })).toBe("abc");
    expect(resumeSessionId({ kind: "terminal", cliSessionId: "abc" })).toBeNull();
    expect(resumeSessionId({ kind: "agent" })).toBeNull();
    expect(resumeSessionId(undefined)).toBeNull();
  });
});
