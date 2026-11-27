import { describe, expect, it } from "vite-plus/test";

import { ToolCallTracker } from "./toolCallTracker";

function call(id: string, name: string, args: string) {
  return { id, type: "function" as const, function: { name, arguments: args } };
}

const diff = { path: "/repo/a.ts", old_text: "a", new_text: "b" };

describe("ToolCallTracker", () => {
  it("merges a refinement into the first report", () => {
    const tracker = new ToolCallTracker();
    expect(
      tracker.report(call("1", "Bash", "{}"), { tool_call_id: "1", title: "Terminal" }),
    ).toEqual({
      type: "tool-input-available",
      toolCallId: "1",
      toolName: "Bash",
      input: {},
      title: "Terminal",
    });
    expect(
      tracker.report(call("1", "", '{"command":"ls"}'), { tool_call_id: "1", title: "ls" }),
    ).toEqual({
      type: "tool-input-available",
      toolCallId: "1",
      toolName: "Bash",
      input: { command: "ls" },
      title: "ls",
    });
  });

  it("keeps the input, title and files a refinement leaves out", () => {
    const tracker = new ToolCallTracker();
    tracker.report(call("1", "Edit", '{"path":"a.ts"}'), {
      tool_call_id: "1",
      title: "Edit a.ts",
      diffs: [diff],
    });
    expect(tracker.report(call("1", "Edit", ""), undefined)).toMatchObject({
      input: { path: "a.ts" },
      title: "Edit a.ts",
      toolMetadata: { diffs: [diff] },
    });
  });

  it("adds a change that comes after the result to the finished call", () => {
    const tracker = new ToolCallTracker();
    tracker.report(call("1", "Edit", "{}"), { tool_call_id: "1", title: "Edit a.ts" });
    tracker.finish("1", "updated");

    expect(tracker.report(null, { tool_call_id: "1", diffs: [diff] })).toEqual({
      type: "tool-output-available",
      toolCallId: "1",
      output: "updated",
      toolMetadata: { diffs: [diff] },
    });
    expect(
      tracker.report(call("1", "Edit", '{"x":1}'), { tool_call_id: "1", title: "x" }),
    ).toBeNull();
  });

  it("ignores nameless calls and changes of failed calls", () => {
    const tracker = new ToolCallTracker();
    expect(tracker.report(call("1", "", "{}"), undefined)).toBeNull();
    tracker.report(call("2", "Edit", "{}"), undefined);
    tracker.finish("2", null);
    expect(tracker.report(null, { tool_call_id: "2", diffs: [diff] })).toBeNull();
  });
});
