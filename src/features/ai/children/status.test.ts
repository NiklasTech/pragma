import { describe, expect, it } from "vite-plus/test";

import { isChildRunning, resolveChildStatus } from "./status";

describe("resolveChildStatus", () => {
  it("reports a conversation that has not sent its prompt as waiting", () => {
    const child = { id: "c", kind: "agent" as const, pendingPrompt: "Go" };
    expect(resolveChildStatus(child, "running", "p", null)).toBe("waiting");
  });

  it("follows the live run only when the child owns it", () => {
    const child = { id: "c", kind: "agent" as const };
    expect(resolveChildStatus(child, "running", "c", null)).toBe("running");
    expect(resolveChildStatus(child, "waiting-approval", "c", null)).toBe("needs-approval");
    expect(resolveChildStatus(child, "done", "c", null)).toBe("done");
    expect(resolveChildStatus(child, "running", "p", null)).toBe("idle");
  });

  it("reads a terminal child from its process", () => {
    const child = { id: "c", kind: "terminal" as const };
    expect(resolveChildStatus(child, "idle", null, "running")).toBe("running");
    expect(resolveChildStatus(child, "idle", null, "exited")).toBe("exited");
    expect(resolveChildStatus(child, "idle", null, "cancelled")).toBe("stopped");
    expect(resolveChildStatus(child, "idle", null, null)).toBe("idle");
  });
});

describe("isChildRunning", () => {
  it("counts running and approval-waiting children", () => {
    expect(isChildRunning("running")).toBe(true);
    expect(isChildRunning("needs-approval")).toBe(true);
    expect(isChildRunning("done")).toBe(false);
    expect(isChildRunning("waiting")).toBe(false);
  });
});
