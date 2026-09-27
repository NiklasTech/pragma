import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());
const scripts = vi.hoisted(() => ({ steps: [] as UIMessageChunk[][] }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@/shared/lib/ai/transport", () => ({
  createStreamTransport: (): ChatTransport<UIMessage> => ({
    sendMessages: async () =>
      new ReadableStream<UIMessageChunk>({
        start(controller) {
          for (const chunk of scripts.steps.shift() ?? []) controller.enqueue(chunk);
          controller.close();
        },
      }),
    reconnectToStream: async () => null,
  }),
}));

import { useAIStore } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";

import { startChildRun, stopChildRun } from "./runner";
import { getChildRun, resolveChildApproval } from "./runStore";

const ROOT = "/workspace";

function text(value: string): UIMessageChunk[] {
  return [
    { type: "start-step" },
    { type: "text-start", id: "t" },
    { type: "text-delta", id: "t", delta: value },
    { type: "text-end", id: "t" },
    { type: "finish-step" },
    { type: "finish", finishReason: "stop" },
  ];
}

function toolCall(toolName: string, input: unknown): UIMessageChunk[] {
  return [
    { type: "start-step" },
    { type: "tool-input-available", toolCallId: `call-${toolName}`, toolName, input },
    { type: "finish-step" },
    { type: "finish", finishReason: "tool-calls" },
  ];
}

describe("child runs", () => {
  beforeEach(() => {
    scripts.steps = [];
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "mcp_list_servers") return [];
      if (command === "agent_run_command") {
        return { stdout: "", stderr: "", exit_code: 0, timed_out: false };
      }
      if (command.startsWith("read")) throw new Error("missing");
      return null;
    });
    useAIStore.setState({
      chatSessions: [
        {
          id: "child",
          title: "Child",
          messages: [],
          createdAt: 0,
          updatedAt: 0,
          kind: "agent",
          agentEngine: { kind: "builtin" },
          parentId: "parent",
        },
      ],
    });
    const settings = useSettingsStore.getState();
    useSettingsStore.setState({
      agent: { ...settings.agent, autoApprove: "never", allowedCommands: [], stepLimit: null },
      ai: { ...settings.ai, yoloMode: false },
    });
  });

  it("finishes after a plain answer and saves the messages", async () => {
    scripts.steps = [text("All set.")];
    await startChildRun(ROOT, "child", "Do it");

    await vi.waitFor(() => expect(getChildRun("child")?.status).toBe("done"));
    const stored = useAIStore.getState().chatSessions[0].messages;
    expect(stored.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(invokeMock).toHaveBeenCalledWith("ai_save_session_messages", expect.anything());
  });

  it("finishes when the agent reports the task complete", async () => {
    scripts.steps = [toolCall("agent_task_complete", { summary: "Tests fixed" })];
    await startChildRun(ROOT, "child", "Fix tests");

    await vi.waitFor(() => expect(getChildRun("child")?.status).toBe("done"));
    expect(getChildRun("child")?.summary).toBe("Tests fixed");
  });

  it("waits for approval and keeps working after a denial", async () => {
    scripts.steps = [toolCall("agent_run_command", { command: "rm -rf build" }), text("Skipped.")];
    await startChildRun(ROOT, "child", "Clean up");

    await vi.waitFor(() => expect(getChildRun("child")?.status).toBe("waiting-approval"));
    resolveChildApproval("child", "call-agent_run_command", false);

    await vi.waitFor(() => expect(getChildRun("child")?.status).toBe("done"));
    expect(invokeMock).not.toHaveBeenCalledWith("agent_run_command", expect.anything());
  });

  it("stops and denies what is still waiting", async () => {
    scripts.steps = [toolCall("agent_run_command", { command: "pnpm build" })];
    await startChildRun(ROOT, "child", "Build");

    await vi.waitFor(() => expect(getChildRun("child")?.status).toBe("waiting-approval"));
    stopChildRun(ROOT, "child");

    expect(getChildRun("child")?.status).toBe("cancelled");
    expect(getChildRun("child")?.approvals).toEqual([]);
  });

  it("does not start when stopped while it was still preparing", async () => {
    scripts.steps = [text("Should not run.")];
    const started = startChildRun(ROOT, "child", "Go");
    stopChildRun(ROOT, "child");
    await started;

    expect(getChildRun("child")?.status).toBe("cancelled");
    expect(scripts.steps).toHaveLength(1);
  });

  it("reports a failed stream as an error", async () => {
    scripts.steps = [[{ type: "error", errorText: "No API key" }]];
    await startChildRun(ROOT, "child", "Go");

    await vi.waitFor(() => expect(getChildRun("child")?.status).toBe("error"));
    expect(getChildRun("child")?.error).toContain("No API key");
  });
});
