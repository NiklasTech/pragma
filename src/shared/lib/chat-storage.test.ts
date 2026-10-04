import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { fromStoredSession, saveSession } from "./chat-storage";

describe("session usage storage", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it("saves usage in snake case", async () => {
    await saveSession("/repo", {
      id: "s1",
      title: "Session",
      messages: [],
      createdAt: 1,
      updatedAt: 2,
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        cacheReadTokens: 80,
        cacheWriteTokens: 0,
        responses: 1,
        contextTokens: 120,
      },
    });

    expect(invokeMock).toHaveBeenCalledWith("ai_save_session", {
      req: {
        root_path: "/repo",
        session: expect.objectContaining({
          usage: {
            input_tokens: 100,
            output_tokens: 20,
            cache_read_tokens: 80,
            cache_write_tokens: 0,
            responses: 1,
            context_tokens: 120,
          },
        }),
      },
    });
  });

  it("restores usage and leaves it out for older sessions", () => {
    const restored = fromStoredSession({
      id: "s1",
      title: "Session",
      created_at: 1,
      updated_at: 2,
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        responses: 1,
        context_window: 200_000,
      },
    });
    expect(restored.usage).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      responses: 1,
      contextWindow: 200_000,
    });

    const older = fromStoredSession({ id: "s2", title: "Old", created_at: 1, updated_at: 1 });
    expect(older.usage).toBeUndefined();
  });
});
