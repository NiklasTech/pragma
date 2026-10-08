import { describe, expect, it } from "vite-plus/test";

import type { UIMessage } from "ai";

import {
  storedMessagesToUI,
  uiMessageToBackendMessages,
  uiMessageToStored,
  withPendingContext,
  type APIChatRequest,
  type CLIChatMessage,
} from "./protocol";

type BackendMessages = APIChatRequest["messages"];

describe("withPendingContext", () => {
  it("prepends the context to the last user message", () => {
    const messages: BackendMessages = [
      { role: "system", content: "system" },
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "second question" },
    ];

    expect(withPendingContext(messages, "CTX")).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "CTX\n\nsecond question" },
    ]);
  });

  it("leaves every other message untouched", () => {
    const messages: BackendMessages = [
      { role: "user", content: "first question" },
      { role: "assistant", content: "answer" },
      { role: "user", content: "second question" },
    ];

    const result = withPendingContext(messages, "CTX");

    expect(result[0]).toBe(messages[0]);
    expect(result[1]).toBe(messages[1]);
    expect(result[2]).not.toBe(messages[2]);
    expect(messages[2].content).toBe("second question");
  });

  it("is a no-op for null or empty context", () => {
    const messages: BackendMessages = [{ role: "user", content: "question" }];

    expect(withPendingContext(messages, null)).toBe(messages);
    expect(withPendingContext(messages, "")).toBe(messages);
  });

  it("is a no-op when there is no user message", () => {
    const messages: BackendMessages = [{ role: "system", content: "system" }];

    expect(withPendingContext(messages, "CTX")).toBe(messages);
  });

  it("keeps the context when the last user message is empty", () => {
    const messages: BackendMessages = [{ role: "user", content: "" }];

    expect(withPendingContext(messages, "CTX")).toEqual([{ role: "user", content: "CTX" }]);
  });

  it("accepts CLI-shaped messages", () => {
    const messages: CLIChatMessage[] = [
      { role: "user", content: "first question" },
      { role: "assistant", content: "answer" },
      { role: "user", content: "second question" },
    ];

    expect(withPendingContext(messages, "CTX")).toEqual([
      { role: "user", content: "first question" },
      { role: "assistant", content: "answer" },
      { role: "user", content: "CTX\n\nsecond question" },
    ]);
  });
});

describe("message images", () => {
  const userWithImage: UIMessage = {
    id: "m1",
    role: "user",
    parts: [
      { type: "file", mediaType: "image/png", url: "data:image/png;base64,aGk=" },
      { type: "file", mediaType: "image/png", url: "https://example.com/remote.png" },
      { type: "text", text: "what is this?" },
    ],
  };

  it("sends inline images of a user message to the backend", () => {
    expect(uiMessageToBackendMessages(userWithImage)).toEqual([
      {
        role: "user",
        content: "what is this?",
        images: [{ media_type: "image/png", data: "aGk=" }],
      },
    ]);
  });

  it("leaves text-only messages without images", () => {
    const message: UIMessage = { id: "m2", role: "user", parts: [{ type: "text", text: "hi" }] };
    expect(uiMessageToBackendMessages(message)).toEqual([{ role: "user", content: "hi" }]);
  });

  it("keeps the images when the pending context is prepended", () => {
    const [message] = withPendingContext(uiMessageToBackendMessages(userWithImage), "CTX");
    expect(message.content).toBe("CTX\n\nwhat is this?");
    expect(message.images).toEqual([{ media_type: "image/png", data: "aGk=" }]);
  });

  it("round-trips images through the stored transcript", () => {
    const stored = uiMessageToStored(userWithImage);
    expect(stored.images).toEqual([{ mediaType: "image/png", data: "aGk=" }]);

    const [restored] = storedMessagesToUI([stored]);
    expect(restored.parts).toEqual([
      { type: "file", mediaType: "image/png", url: "data:image/png;base64,aGk=" },
      { type: "text", text: "what is this?" },
    ]);
  });
});

describe("tool outputs with images", () => {
  function toolMessage(output: unknown): UIMessage {
    return {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "agent_browser_screenshot",
          toolCallId: "call_1",
          state: "output-available",
          input: {},
          output,
        },
      ],
    };
  }

  it("sends the text as content and the images separately", () => {
    const messages = uiMessageToBackendMessages(
      toolMessage({ text: "Screenshot", images: [{ mediaType: "image/png", data: "aGk=" }] }),
    );
    expect(messages[1]).toEqual({
      role: "tool",
      content: "Screenshot",
      tool_call_id: "call_1",
      images: [{ media_type: "image/png", data: "aGk=" }],
    });
  });

  it("keeps string and object outputs as text without images", () => {
    expect(uiMessageToBackendMessages(toolMessage("done"))[1]).toEqual({
      role: "tool",
      content: "done",
      tool_call_id: "call_1",
    });
    expect(uiMessageToBackendMessages(toolMessage({ count: 2 }))[1].content).toBe('{"count":2}');
  });
});
