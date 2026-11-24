import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { UIMessageChunk } from "ai";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  save: vi.fn(),
  outcome: vi.fn(),
  finished: vi.fn(),
  taskDone: vi.fn(),
  sessions: [{ id: "s1", title: "Chat" }],
}));

vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({
      chatSessions: mocks.sessions,
      updateChatSessionMessages: mocks.update,
      saveSessionMessages: mocks.save,
    }),
  },
}));
vi.mock("@/features/extensions/events", () => ({ notifySessionFinished: mocks.finished }));
vi.mock("../notifications/outcomes", () => ({ reportSessionOutcome: mocks.outcome }));
vi.mock("../tasks/store", () => ({
  useTasksStore: { getState: () => ({ handleSessionDone: mocks.taskDone }) },
}));

import { stopBackgroundChat, useBackgroundChatsStore } from "./backgroundChats";
import { createChatInstance, findChatInstance, retainChatInstance } from "./chatInstances";

/** A chat whose answer arrives by hand, like a coding CLI that takes its time. */
function controlledChat(id: string, keepRunning: boolean) {
  let controller!: ReadableStreamDefaultController<UIMessageChunk>;
  let aborted = false;
  const instance = createChatInstance(id, [], {
    transport: {
      sendMessages: async ({ abortSignal }) => {
        abortSignal?.addEventListener("abort", () => {
          aborted = true;
          controller.error(new DOMException("aborted", "AbortError"));
        });
        return new ReadableStream<UIMessageChunk>({
          start: (next) => {
            controller = next;
          },
        });
      },
      reconnectToStream: async () => null,
    },
  });
  instance.sessionId = "s1";
  instance.keepRunning = keepRunning;
  return {
    instance,
    isAborted: () => aborted,
    write: (...chunks: UIMessageChunk[]) => chunks.forEach((chunk) => controller.enqueue(chunk)),
    end: () => {
      controller.enqueue({ type: "text-end", id: "t" });
      controller.enqueue({ type: "finish" });
      controller.close();
    },
  };
}

async function startAnswer(chat: ReturnType<typeof controlledChat>) {
  void chat.instance.chat.sendMessage({ text: "count" });
  await vi.waitFor(() => expect(chat.instance.chat.status).toBe("submitted"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  chat.write({ type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "1 2" });
  await vi.waitFor(() => expect(chat.instance.chat.status).toBe("streaming"));
}

function lastText(): string {
  const calls = mocks.update.mock.calls as Array<[string, Array<{ content: string }>]>;
  const stored = calls[calls.length - 1]?.[1] ?? [];
  return stored[stored.length - 1]?.content ?? "";
}

describe("chat instances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.save.mockResolvedValue(undefined);
    mocks.sessions = [{ id: "s1", title: "Chat" }];
    useBackgroundChatsStore.setState({ running: [] });
  });

  it("keeps a CLI's answer going after its pane closed, stores it and reports the end", async () => {
    const chat = controlledChat("keep", true);
    const release = retainChatInstance(chat.instance);
    await startAnswer(chat);
    release();

    expect(chat.isAborted()).toBe(false);
    expect(useBackgroundChatsStore.getState().running).toEqual(["s1"]);

    chat.write({ type: "text-delta", id: "t", delta: " 3 4" });
    chat.end();
    await vi.waitFor(() => expect(useBackgroundChatsStore.getState().running).toEqual([]));
    expect(lastText()).toBe("1 2 3 4");
    expect(mocks.save).toHaveBeenCalled();
    expect(mocks.taskDone).toHaveBeenCalledWith("s1", null);
    expect(mocks.outcome).toHaveBeenCalledWith("s1", "done");
    expect(findChatInstance("keep")).toBe(chat.instance);
  });

  it("hands the running chat to the pane that shows it again", async () => {
    const chat = controlledChat("return", true);
    const release = retainChatInstance(chat.instance);
    await startAnswer(chat);
    release();

    const again = findChatInstance("return");
    expect(again).toBe(chat.instance);
    const releaseAgain = retainChatInstance(chat.instance);
    expect(useBackgroundChatsStore.getState().running).toEqual([]);
    chat.end();
    await vi.waitFor(() => expect(chat.instance.chat.status).toBe("ready"));
    expect(mocks.outcome).not.toHaveBeenCalled();
    releaseAgain();
    expect(findChatInstance("return")).toBeUndefined();
  });

  it("stops Pragma's own agent with its pane, as its tools need the chat", async () => {
    const chat = controlledChat("own", false);
    const release = retainChatInstance(chat.instance);
    await startAnswer(chat);
    release();
    await vi.waitFor(() => expect(chat.isAborted()).toBe(true));
    expect(useBackgroundChatsStore.getState().running).toEqual([]);
    expect(findChatInstance("own")).toBeUndefined();
  });

  it("can be stopped without a pane and then reports nothing", async () => {
    const chat = controlledChat("stop", true);
    const release = retainChatInstance(chat.instance);
    await startAnswer(chat);
    release();

    expect(stopBackgroundChat("other")).toBe(false);
    expect(stopBackgroundChat("s1")).toBe(true);
    await vi.waitFor(() => expect(useBackgroundChatsStore.getState().running).toEqual([]));
    expect(chat.isAborted()).toBe(true);
    expect(mocks.outcome).not.toHaveBeenCalled();
  });

  it("writes nothing for a session deleted meanwhile", async () => {
    const chat = controlledChat("deleted", true);
    const release = retainChatInstance(chat.instance);
    await startAnswer(chat);
    release();
    mocks.sessions = [];
    chat.end();
    await vi.waitFor(() => expect(useBackgroundChatsStore.getState().running).toEqual([]));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.outcome).not.toHaveBeenCalled();
    expect(findChatInstance("deleted")).toBeUndefined();
  });
});
