import { describe, expect, it } from "vite-plus/test";

import { childThreadStatus, isChildRunning, resolveChildStatus } from "./status";

describe("resolveChildStatus", () => {
  it("reads a conversation from its background run", () => {
    const child = { id: "c", kind: "agent" as const };
    expect(resolveChildStatus(child, "running", "p", null, "running")).toBe("running");
    expect(resolveChildStatus(child, "idle", null, null, "waiting-approval")).toBe(
      "needs-approval",
    );
    expect(resolveChildStatus(child, "idle", null, null, "done")).toBe("done");
    expect(resolveChildStatus(child, "idle", null, null, "cancelled")).toBe("stopped");
  });

  it("prefers a live turn in the focused chat over the finished background run", () => {
    const child = { id: "c", kind: "agent" as const };
    expect(resolveChildStatus(child, "running", "c", null, "done")).toBe("running");
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
    expect(isChildRunning("idle")).toBe(false);
  });
});

describe("childThreadStatus", () => {
  it("maps a child's status to the list's status dot", () => {
    expect(childThreadStatus("running")).toBe("running");
    expect(childThreadStatus("needs-approval")).toBe("waiting-approval");
    expect(childThreadStatus("error")).toBe("error");
    expect(childThreadStatus("done")).toBe("idle");
  });
});
