import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import { describe, expect, it, vi } from "vite-plus/test";

import type { StreamChunk } from "./protocol";

const script = vi.hoisted(() => ({ chunks: [] as StreamChunk[] }));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage: (chunk: StreamChunk) => void = () => {};
  },
  invoke: vi.fn(
    async (_command: string, args: { channel: { onmessage: (c: StreamChunk) => void } }) => {
      for (const chunk of script.chunks) args.channel.onmessage(chunk);
    },
  ),
}));

const { createStreamTransport } = await import("./transport");

async function run(chunks: StreamChunk[]): Promise<UIMessage> {
  script.chunks = chunks;
  const transport = createStreamTransport(
    "anthropic",
    "model",
    undefined,
    true,
    "anthropic-claude",
    [],
    "/tmp",
    "chat-1",
    true,
  );
  const stream = await transport.sendMessages({
    trigger: "submit-message",
    chatId: "chat-1",
    messageId: undefined,
    messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] }],
    abortSignal: undefined,
  });
  let last: UIMessage | undefined;
  for await (const message of readUIMessageStream({
    stream: stream as ReadableStream<UIMessageChunk>,
  })) {
    last = message;
  }
  if (!last) throw new Error("no message");
  return last;
}

function call(id: string, name: string, args: string) {
  return { id, type: "function" as const, function: { name, arguments: args } };
}

describe("createStreamTransport", () => {
  it("keeps thinking, tool calls and text in the order they arrive", async () => {
    const message = await run([
      { reasoning: "plan" },
      {
        tool_calls: [call("t1", "Bash", "{}")],
        tool_titles: [{ tool_call_id: "t1", title: "Terminal" }],
      },
      {
        tool_calls: [call("t1", "Bash", '{"command":"ls"}')],
        tool_titles: [{ tool_call_id: "t1", title: "ls" }],
      },
      { tool_results: [{ tool_call_id: "t1", output: "a.ts", is_error: false }] },
      { text: "Done." },
      { done: true },
    ]);

    const parts = message.parts.filter(
      (part) => part.type !== "step-start" && !(part.type === "text" && part.text === ""),
    );
    expect(parts.map((part) => part.type)).toEqual(["reasoning", "tool-Bash", "text"]);
    expect(parts[1]).toMatchObject({
      toolCallId: "t1",
      title: "ls",
      input: { command: "ls" },
      state: "output-available",
      output: "a.ts",
    });
  });
});
