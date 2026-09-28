import { describe, expect, it } from "vite-plus/test";

import { pinnedSessionEngine } from "./sessionEngine";

describe("pinnedSessionEngine", () => {
  it("returns the pinned engine", () => {
    const engine = { kind: "builtin" as const, provider: "custom" as const, model: "qwen" };
    expect(pinnedSessionEngine({ kind: "agent", agentEngine: engine })).toBe(engine);
  });

  it("pins the CLI of an older coding CLI conversation", () => {
    expect(pinnedSessionEngine({ kind: "agent", cliProviderId: "claude-code" })).toEqual({
      kind: "cli",
      cliProviderId: "claude-code",
    });
  });

  it("leaves terminal and unpinned sessions on the global selection", () => {
    expect(pinnedSessionEngine({ kind: "terminal", cliProviderId: "claude-code" })).toBeNull();
    expect(pinnedSessionEngine({ kind: "agent" })).toBeNull();
    expect(pinnedSessionEngine(undefined)).toBeNull();
  });
});
