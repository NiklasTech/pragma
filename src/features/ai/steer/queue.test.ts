import { describe, expect, it } from "vite-plus/test";

import { decideRemove, decideStopIntent, decideSubmit, shouldFlush } from "./queue";

describe("steer queue decisions", () => {
  it("queues the first trimmed message and clears the composer", () => {
    expect(decideSubmit(null, "  hello  ")).toEqual({
      action: "queue",
      queued: "hello",
      restore: null,
    });
  });

  it("replaces the slot and restores the previous text", () => {
    expect(decideSubmit("old", "new")).toEqual({
      action: "replace",
      queued: "new",
      restore: "old",
    });
  });

  it("ignores whitespace", () => {
    expect(decideSubmit("old", "   ")).toEqual({
      action: "ignore",
      queued: "old",
      restore: null,
    });
  });

  it("removes the slot without sending", () => {
    const decision = decideRemove();
    expect(decision.action).toBe("remove");
    expect(decision.queued).toBeNull();
    expect(decision.restore).toBeNull();
  });

  it("steers only when a message is queued", () => {
    expect(decideStopIntent("queued")).toBe("steer");
    expect(decideStopIntent(null)).toBe("cancel");
  });

  it("flushes after a turn unless the chat or this session's own run failed", () => {
    const base = { queued: "next", chatFailed: false, ownedRun: false, runFailed: false };
    expect(shouldFlush(base)).toBe(true);
    expect(shouldFlush({ ...base, queued: null })).toBe(false);
    expect(shouldFlush({ ...base, chatFailed: true })).toBe(false);
    expect(shouldFlush({ ...base, ownedRun: true, runFailed: true })).toBe(false);
  });

  it("ignores a failed run that belonged to another session", () => {
    expect(
      shouldFlush({ queued: "next", chatFailed: false, ownedRun: false, runFailed: true }),
    ).toBe(true);
  });
});
