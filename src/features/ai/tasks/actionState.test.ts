import { describe, expect, it } from "vite-plus/test";

import { resolveTaskActions } from "./actionState";

describe("task actions", () => {
  it("allows only Run without a linked session", () => {
    expect(resolveTaskActions({}, null, false)).toEqual({
      canRun: true,
      canStop: false,
      canResume: false,
    });
  });

  it("allows Stop only while the linked session runs", () => {
    expect(resolveTaskActions({ sessionId: "s1" }, "s1", true)).toEqual({
      canRun: false,
      canStop: true,
      canResume: false,
    });
  });

  it("allows Run and Resume on a linked session that is not running", () => {
    expect(resolveTaskActions({ sessionId: "s1" }, null, true)).toEqual({
      canRun: true,
      canStop: false,
      canResume: true,
    });
  });

  it("does not resume a session that no longer exists", () => {
    expect(resolveTaskActions({ sessionId: "s1" }, null, false).canResume).toBe(false);
  });

  it("waits while another session runs", () => {
    expect(resolveTaskActions({ sessionId: "s1" }, "s2", true)).toEqual({
      canRun: false,
      canStop: false,
      canResume: false,
    });
  });
});

describe("blocked task actions", () => {
  it("cannot run or resume while a blocker is open", () => {
    expect(resolveTaskActions({ sessionId: "s1" }, null, true, true)).toEqual({
      canRun: false,
      canStop: false,
      canResume: false,
    });
  });

  it("can still be stopped while it runs", () => {
    expect(resolveTaskActions({ sessionId: "s1" }, "s1", true, true).canStop).toBe(true);
  });
});
