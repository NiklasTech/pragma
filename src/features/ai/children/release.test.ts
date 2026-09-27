import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { outsideChildren, releaseChildren } from "./release";

function session(id: string, init: Partial<ChatSession> = {}): ChatSession {
  return { id, title: id, messages: [], createdAt: 0, updatedAt: 0, kind: "agent", ...init };
}

function stored(id: string): ChatSession | undefined {
  return useAIStore.getState().chatSessions.find((item) => item.id === id);
}

describe("releaseChildren", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    useAIStore.setState({
      chatSessions: [
        session("parent"),
        session("child", { parentId: "parent" }),
        session("grandchild", { parentId: "child" }),
        session("other"),
      ],
    });
  });

  it("archives children and grandchildren", async () => {
    await releaseChildren("/workspace", ["parent"], true);

    expect(stored("child")?.archived).toBe(true);
    expect(stored("grandchild")?.archived).toBe(true);
    expect(stored("parent")?.archived).toBeUndefined();
    expect(stored("other")?.archived).toBeUndefined();
  });

  it("keeps children without a parent link when they are not archived", async () => {
    await releaseChildren("/workspace", ["parent"], false);

    expect(stored("child")?.parentId).toBeUndefined();
    expect(stored("child")?.archived).toBeUndefined();
    expect(stored("grandchild")?.parentId).toBe("child");
  });
});

describe("outsideChildren", () => {
  it("skips children that are part of the released set", () => {
    const sessions = [
      session("a"),
      session("b", { parentId: "a" }),
      session("c", { parentId: "a" }),
    ];
    expect(outsideChildren(sessions, ["a", "b"]).map((item) => item.id)).toEqual(["c"]);
  });
});
