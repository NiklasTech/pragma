import { describe, expect, it } from "vite-plus/test";

import { withPendingContext, type APIChatRequest, type CLIChatMessage } from "./protocol";

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
