import { describe, expect, it } from "vite-plus/test";

import { ToolCallTracker } from "./toolCallTracker";

function call(id: string, name: string, args: string) {
  return { id, type: "function" as const, function: { name, arguments: args } };
}

describe("ToolCallTracker", () => {
  it("merges a refinement into the first report", () => {
    const tracker = new ToolCallTracker();
    expect(tracker.update(call("1", "Bash", "{}"), "Terminal")).toEqual({
      toolCallId: "1",
      toolName: "Bash",
      input: {},
      title: "Terminal",
    });
    expect(tracker.update(call("1", "", '{"command":"ls"}'), "ls")).toEqual({
      toolCallId: "1",
      toolName: "Bash",
      input: { command: "ls" },
      title: "ls",
    });
  });

  it("keeps the input and title a refinement leaves out", () => {
    const tracker = new ToolCallTracker();
    tracker.update(call("1", "Read", '{"path":"a.ts"}'), "Read a.ts");
    expect(tracker.update(call("1", "Read", ""), undefined)).toMatchObject({
      input: { path: "a.ts" },
      title: "Read a.ts",
    });
  });

  it("ignores reports of finished or nameless calls", () => {
    const tracker = new ToolCallTracker();
    expect(tracker.update(call("1", "", "{}"), undefined)).toBeNull();
    tracker.update(call("2", "Bash", "{}"), undefined);
    tracker.finish("2");
    expect(tracker.update(call("2", "Bash", '{"command":"ls"}'), "ls")).toBeNull();
  });
});
