import { describe, expect, it } from "vite-plus/test";

import type { UIMessage } from "ai";

import { createCompactionMessage, isCompactionMessage, requestMessages } from "./compaction";
import { getMessageText, storedMessagesToUI, uiMessageToStored } from "./protocol";

function text(id: string, role: UIMessage["role"], content: string): UIMessage {
  return { id, role, parts: [{ type: "text", text: content }] };
}

describe("requestMessages", () => {
  it("sends every message when nothing was compacted", () => {
    const messages = [text("1", "user", "hi"), text("2", "assistant", "hello")];
    expect(requestMessages(messages)).toBe(messages);
  });

  it("drops messages before the latest summary and leads the next user turn with it", () => {
    const messages = [
      text("1", "user", "old question"),
      text("2", "assistant", "old answer"),
      createCompactionMessage("first summary", "s1"),
      text("3", "user", "middle question"),
      createCompactionMessage("second summary", "s2"),
      text("4", "user", "new question"),
      text("5", "assistant", "new answer"),
    ];

    const sent = requestMessages(messages);

    expect(sent.map((message) => message.id)).toEqual(["4", "5"]);
    const first = getMessageText(sent[0]);
    expect(first).toContain("second summary");
    expect(first).not.toContain("first summary");
    expect(first.endsWith("new question")).toBe(true);
  });
});

describe("compaction messages in storage", () => {
  it("round trip through stored messages", () => {
    const stored = uiMessageToStored(createCompactionMessage("the summary", "s1"));
    expect(stored).toMatchObject({ id: "s1", role: "system", kind: "compaction" });
    expect(stored.content).toBe("the summary");

    const [restored] = storedMessagesToUI([stored]);
    expect(isCompactionMessage(restored)).toBe(true);
    expect(isCompactionMessage(text("2", "system", "plain system"))).toBe(false);
  });
});
