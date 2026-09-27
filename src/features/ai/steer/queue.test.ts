import { describe, expect, it } from "vite-plus/test";

import { decideRemove, decideStopIntent, decideSubmit } from "./queue";

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
});
