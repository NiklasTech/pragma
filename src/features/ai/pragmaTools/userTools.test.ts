import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  system: vi.fn(),
  tone: vi.fn(),
  notifications: { card: true, system: true, sound: false },
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: { getState: () => ({ chatSessions: [{ id: "s1", title: "Fix tests" }] }) },
}));
vi.mock("@/shared/stores/settings", () => ({
  useSettingsStore: { getState: () => ({ notifications: mocks.notifications }) },
}));
vi.mock("../notifications/attentionCards", () => ({ playAttentionTone: mocks.tone }));
vi.mock("../notifications/focusSession", () => ({ focusAttentionSession: vi.fn() }));
vi.mock("../notifications/notifier", () => ({ showSystemNotification: mocks.system }));

const { USER_TOOLS } = await import("./userTools");
const { chooseSpawnOption, resolveSpawnApproval, useSpawnApprovalsStore } =
  await import("../children/acpSpawn");

const context = { sessionId: "s1", requestId: "r1", cwd: "/p", rootPath: "/p" };

function pending() {
  return useSpawnApprovalsStore.getState().bySession.s1 ?? [];
}

describe("ask_user", () => {
  beforeEach(() => useSpawnApprovalsStore.setState({ bySession: {} }));

  it("waits for the option the user picks", async () => {
    const answer = USER_TOOLS.ask_user(
      { question: "Which database?", options: ["Postgres", " SQLite ", ""] },
      context,
    );
    await Promise.resolve();
    expect(pending()[0]).toMatchObject({
      toolCallId: "r1",
      toolName: "ask_user",
      description: "Which database?",
      options: ["Postgres", "SQLite"],
    });
    chooseSpawnOption("s1", "r1", "SQLite");
    await expect(answer).resolves.toBe("The user chose: SQLite");
    expect(pending()).toEqual([]);
  });

  it("tells the agent when the user dismisses the question", async () => {
    const answer = USER_TOOLS.ask_user({ question: "Go on?", options: ["Yes", "No"] }, context);
    await Promise.resolve();
    resolveSpawnApproval("s1", "r1", false);
    await expect(answer).resolves.toContain("dismissed");
  });

  it("needs a question and 2 to 9 options", async () => {
    await expect(USER_TOOLS.ask_user({ options: ["a", "b"] }, context)).rejects.toThrow("question");
    await expect(USER_TOOLS.ask_user({ question: "?", options: ["a"] }, context)).rejects.toThrow(
      "2 to 9",
    );
  });
});

describe("notify_user", () => {
  beforeEach(() => {
    mocks.toast.mockReset();
    mocks.system.mockReset().mockResolvedValue(undefined);
    mocks.notifications = { card: true, system: true, sound: false };
  });

  it("shows a toast titled with the session while Pragma is in front", async () => {
    vi.stubGlobal("document", { hasFocus: () => true });
    await expect(USER_TOOLS.notify_user({ message: "Build is green" }, context)).resolves.toBe(
      "The user was notified.",
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      "Fix tests",
      expect.objectContaining({ description: "Build is green" }),
    );
  });

  it("sends a system notification in the background and respects the settings", async () => {
    vi.stubGlobal("document", { hasFocus: () => false });
    await USER_TOOLS.notify_user({ message: "Done" }, context);
    expect(mocks.system).toHaveBeenCalledWith("Fix tests", "Done", false);
    mocks.notifications.system = false;
    await expect(USER_TOOLS.notify_user({ message: "Done" }, context)).resolves.toContain(
      "turned off",
    );
  });
});
