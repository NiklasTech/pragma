import { describe, expect, it } from "vite-plus/test";
import type { UIMessage } from "@ai-sdk/react";

import { getMessageText } from "./useAI";

describe("getMessageText", () => {
  it("joins text parts into a single string", () => {
    const message = {
      id: "msg-1",
      role: "user",
      content: "Hello world",
      parts: [
        { type: "text" as const, text: "Hello " },
        { type: "text" as const, text: "world" },
      ],
    } as UIMessage;

    expect(getMessageText(message)).toBe("Hello world");
  });

  it("ignores non-text parts", () => {
    const message = {
      id: "msg-2",
      role: "assistant",
      content: "ok",
      parts: [
        { type: "text" as const, text: "ok" },
        { type: "tool-invocation" as const, toolInvocation: {} },
      ],
    } as unknown as UIMessage;

    expect(getMessageText(message)).toBe("ok");
  });
});
