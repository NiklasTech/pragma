import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { mergeSessionsWithStored, useAIStore, type ChatMessage, type ChatSession } from "./ai";

function message(id: string): ChatMessage {
  return { id, role: "user", content: id, timestamp: 1 };
}

function storedSession(id: string, updatedAt: number): ChatSession {
  return {
    id,
    rootPath: "/workspace",
    title: `stored-${id}`,
    messages: [],
    createdAt: 1,
    updatedAt,
  };
}

function memorySession(
  id: string,
  options: { messages?: ChatMessage[]; updatedAt?: number } = {},
): ChatSession {
  return {
    id,
    rootPath: "/workspace",
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

  it("keeps in-memory kind, environment and environment id over the disk values", () => {
    const disk = storedSession("a", 100);
    disk.kind = "agent";
    disk.environment = "worktree";
    disk.environmentId = "env-old";

    const memory = memorySession("a", { messages: [message("m1")] });
    memory.kind = "agent";
    memory.environment = "worktree";
    memory.environmentId = "env-new";

    const merged = mergeSessionsWithStored([disk], [memory]);

    expect(merged[0].environmentId).toBe("env-new");
  });

  it("keeps disk kind, environment and environment id when the in-memory session omits them", () => {
    const disk = storedSession("a", 100);
    disk.kind = "agent";
    disk.environment = "worktree";
    disk.environmentId = "env-a";

    const merged = mergeSessionsWithStored(
      [disk],
      [memorySession("a", { messages: [message("m1")] })],
    );

    expect(merged[0].kind).toBe("agent");
    expect(merged[0].environment).toBe("worktree");
    expect(merged[0].environmentId).toBe("env-a");
  });
});

describe("loadSessionMessages", () => {
  it("leaves the session list untouched when nothing is stored", async () => {
    invokeMock.mockResolvedValueOnce([]);
    const sessions = [memorySession("empty")];
    useAIStore.setState({ chatSessions: sessions });

    await useAIStore.getState().loadSessionMessages("empty");

    expect(useAIStore.getState().chatSessions).toBe(sessions);
  });

  it("stores loaded messages on the session", async () => {
    invokeMock.mockResolvedValueOnce([{ id: "m1", role: "user", content: "hi", timestamp: 1 }]);
    useAIStore.setState({ chatSessions: [memorySession("filled")] });

    await useAIStore.getState().loadSessionMessages("filled");

    expect(useAIStore.getState().chatSessions[0].messages).toHaveLength(1);
  });
});

interface InvokeArgs {
  req: { root_path: string; session_id?: string };
}

function storedMetadata(id: string, updatedAt: number) {
  return { id, title: id, created_at: 1, updated_at: updatedAt };
}

function repoSession(id: string, rootPath: string): ChatSession {
  return { id, rootPath, title: id, messages: [], createdAt: 1, updatedAt: 1 };
}

function rootsOf(sessions: ChatSession[]): Record<string, string> {
  return Object.fromEntries(sessions.map((session) => [session.id, session.rootPath]));
}

describe("sessions of several repositories", () => {
  const stored: Record<string, ReturnType<typeof storedMetadata>[]> = {
    "/a": [storedMetadata("a1", 200), storedMetadata("a2", 100)],
    "/b": [storedMetadata("b1", 300)],
  };

  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string, args: InvokeArgs) =>
      command === "ai_load_sessions" ? (stored[args.req.root_path] ?? []) : [],
    );
    useAIStore.setState({ chatSessions: [], activeChatSessionId: null });
  });

  it("loads two repositories side by side and tags each session with its repository", async () => {
    await useAIStore.getState().loadSessions("/a");
    await useAIStore.getState().loadSessions("/b", { activate: false });

    const { chatSessions, activeChatSessionId } = useAIStore.getState();
    expect(rootsOf(chatSessions)).toEqual({ a1: "/a", a2: "/a", b1: "/b" });
    expect(activeChatSessionId).toBe("a1");
  });

  it("keeps the other repositories when a repository loads again", async () => {
    await useAIStore.getState().loadSessions("/a");
    await useAIStore.getState().loadSessions("/b", { activate: false });
    useAIStore.getState().updateChatSessionMessages("b1", [message("m1")]);

    await useAIStore.getState().loadSessions("/a");

    const b1 = useAIStore.getState().chatSessions.find((session) => session.id === "b1");
    expect(b1?.messages.map((m) => m.id)).toEqual(["m1"]);
  });

  it("activates a session of the repository that loads as the active one", async () => {
    await useAIStore.getState().loadSessions("/a");
    await useAIStore.getState().loadSessions("/b");

    expect(useAIStore.getState().activeChatSessionId).toBe("b1");
    expect(useAIStore.getState().chatSessions).toHaveLength(3);
  });

  it("creates no session for an empty repository loaded in the background", async () => {
    await useAIStore.getState().loadSessions("/empty", { activate: false });

    expect(useAIStore.getState().chatSessions).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalledWith("ai_save_session", expect.anything());
  });

  it("drops only the sessions of a closed repository", async () => {
    await useAIStore.getState().loadSessions("/a", { activate: false });
    await useAIStore.getState().loadSessions("/b");

    useAIStore.getState().unloadSessions("/b");

    expect(rootsOf(useAIStore.getState().chatSessions)).toEqual({ a1: "/a", a2: "/a" });
    expect(useAIStore.getState().activeChatSessionId).toBeNull();
  });
});

describe("saving sessions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue([]);
    useAIStore.setState({
      chatSessions: [repoSession("a1", "/a"), repoSession("b1", "/b")],
      activeChatSessionId: "a1",
    });
  });

  function rootOfCall(command: string): string | undefined {
    const call = invokeMock.mock.calls.find(([name]) => name === command);
    return (call?.[1] as InvokeArgs | undefined)?.req.root_path;
  }

  it("saves metadata to the session's repository", async () => {
    const session = useAIStore.getState().chatSessions[1];
    await useAIStore.getState().updateChatSession({ ...session, title: "Renamed" });

    expect(rootOfCall("ai_save_session")).toBe("/b");
  });

  it("saves messages to the session's repository", async () => {
    await useAIStore.getState().saveSessionMessages("b1", [message("m1")]);

    expect(rootOfCall("ai_save_session_messages")).toBe("/b");
  });

  it("renames, loads and deletes in the session's repository", async () => {
    await useAIStore.getState().renameChatSession("b1", "Renamed");
    await useAIStore.getState().loadSessionMessages("b1");
    await useAIStore.getState().deleteSession("b1");

    expect(rootOfCall("ai_save_session")).toBe("/b");
    expect(rootOfCall("ai_load_session_messages")).toBe("/b");
    expect(rootOfCall("ai_delete_session")).toBe("/b");
  });

  it("creates a session in the repository it is started for", async () => {
    const session = await useAIStore.getState().createChatSession("/b", { title: "New" });

    expect(session.rootPath).toBe("/b");
    expect(rootOfCall("ai_save_session")).toBe("/b");
  });
});
