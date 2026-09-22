import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { mergeSessionsWithStored, type ChatMessage, type ChatSession } from "./ai";

function message(id: string): ChatMessage {
  return { id, role: "user", content: id, timestamp: 1 };
}

function storedSession(id: string, updatedAt: number): ChatSession {
  return { id, title: `stored-${id}`, messages: [], createdAt: 1, updatedAt };
}

function memorySession(
  id: string,
  options: { messages?: ChatMessage[]; updatedAt?: number } = {},
): ChatSession {
  return {
    id,
    title: `memory-${id}`,
    messages: options.messages ?? [],
    createdAt: 1,
    updatedAt: options.updatedAt ?? 1,
  };
}

describe("mergeSessionsWithStored", () => {
  it("keeps in-memory messages for sessions that exist on disk", () => {
    const merged = mergeSessionsWithStored(
      [storedSession("a", 100)],
      [memorySession("a", { messages: [message("m1")], updatedAt: 50 })],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].messages.map((m) => m.id)).toEqual(["m1"]);
  });

  it("takes disk metadata for title when in-memory has none newer", () => {
    const merged = mergeSessionsWithStored(
      [storedSession("a", 100)],
      [memorySession("a", { messages: [message("m1")] })],
    );

    expect(merged[0].title).toBe("stored-a");
  });

  it("keeps the newer updatedAt from either side", () => {
    const memoryNewer = mergeSessionsWithStored(
      [storedSession("a", 100)],
      [memorySession("a", { updatedAt: 200 })],
    );
    expect(memoryNewer[0].updatedAt).toBe(200);

    const diskNewer = mergeSessionsWithStored(
      [storedSession("b", 300)],
      [memorySession("b", { updatedAt: 100 })],
    );
    expect(diskNewer[0].updatedAt).toBe(300);
  });

  it("falls back to the disk session when memory has no messages", () => {
    const merged = mergeSessionsWithStored(
      [storedSession("a", 100)],
      [memorySession("a", { updatedAt: 200 })],
    );

    expect(merged[0].messages).toEqual([]);
  });

  it("drops in-memory sessions that are not on disk", () => {
    const merged = mergeSessionsWithStored([storedSession("a", 100)], [memorySession("gone")]);

    expect(merged.map((s) => s.id)).toEqual(["a"]);
  });

  it("sorts merged sessions by updatedAt descending", () => {
    const merged = mergeSessionsWithStored(
      [storedSession("old", 100), storedSession("new", 300)],
      [memorySession("old", { messages: [message("m1")], updatedAt: 500 })],
    );

    expect(merged.map((s) => s.id)).toEqual(["old", "new"]);
  });
});
