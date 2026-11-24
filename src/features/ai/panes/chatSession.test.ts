import { describe, expect, it } from "vite-plus/test";

import { chatSessionFor } from "./chatSession";
import { createLeaf, createSplit, createTabs, type PaneRoot } from "./operations";

function tab(...sessionIds: Array<string | null>): PaneRoot {
  return createSplit(
    "horizontal",
    sessionIds.map((id) => {
      const leaf = createLeaf(id);
      return createTabs([leaf], leaf.id, `group-${leaf.id}`);
    }),
  );
}

const isChat = (id: string) => id.startsWith("chat");

describe("chatSessionFor", () => {
  it("keeps the chat live while a terminal beside it has the focus", () => {
    const root = tab("chat-a", "shell-1", "shell-2");
    expect(
      chatSessionFor({ root, focusedSessionId: "shell-2", focusOrder: ["shell-2"] }, isChat),
    ).toBe("chat-a");
  });

  it("follows the focus between chats and remembers the last one", () => {
    const root = tab("chat-a", "chat-b", "shell-1");
    expect(
      chatSessionFor(
        { root, focusedSessionId: "chat-b", focusOrder: ["chat-b", "chat-a"] },
        isChat,
      ),
    ).toBe("chat-b");
    expect(
      chatSessionFor(
        { root, focusedSessionId: "shell-1", focusOrder: ["shell-1", "chat-b", "chat-a"] },
        isChat,
      ),
    ).toBe("chat-b");
  });

  it("ignores chats of other tabs and falls back to the focused session", () => {
    const root = tab("shell-1", null);
    expect(
      chatSessionFor(
        { root, focusedSessionId: "shell-1", focusOrder: ["chat-elsewhere", "shell-1"] },
        isChat,
      ),
    ).toBe("shell-1");
    expect(
      chatSessionFor({ root: null, focusedSessionId: null, focusOrder: [] }, isChat),
    ).toBeNull();
  });
});
