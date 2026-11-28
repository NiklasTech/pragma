import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  approve: vi.fn(),
  autoApprove: "never",
  screen: ["$ claude", "> Fixing the tests", "", ""],
}));

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    buffer = {
      active: {
        length: mocks.screen.length,
        getLine: (index: number) => ({ translateToString: () => mocks.screen[index] }),
      },
    };
    write(_data: string, done: () => void) {
      done();
    }
    dispose() {}
  },
}));
vi.mock("@/shared/stores/ai", () => ({
  useAIStore: {
    getState: () => ({
      chatSessions: [
        { id: "me", rootPath: "/p", title: "Lead", kind: "terminal", messages: [] },
        { id: "t1", rootPath: "/p", title: "Tests", kind: "terminal", messages: [] },
        {
          id: "c1",
          rootPath: "/p",
          title: "Docs",
          kind: "agent",
          messages: [
            { role: "user", content: "Write docs" },
            { role: "assistant", content: "Done." },
          ],
        },
        { id: "x1", rootPath: "/other", title: "Elsewhere", kind: "agent", messages: [] },
        { id: "a1", rootPath: "/p", title: "Old", archived: true, messages: [] },
      ],
      cliManifests: [],
    }),
  },
}));
vi.mock("@/shared/stores/settings", () => ({
  useSettingsStore: { getState: () => ({ ai: { yoloMode: false } }) },
}));
vi.mock("@/shared/stores/workspaceSettings/effective", () => ({
  getAgentSettings: () => ({ autoApprove: mocks.autoApprove }),
}));
vi.mock("@/shell/chrome/commandLine/delivery", () => ({ deliverToSession: mocks.deliver }));
vi.mock("../children/acpSpawn", () => ({ requestSpawnApproval: mocks.approve }));
vi.mock("../sessions/sessionAgent", () => ({
  sessionAgentManifest: (_state: unknown, id: string) =>
    id === "c1" ? undefined : { name: "Claude Code" },
}));
vi.mock("../state/agentStates", () => ({
  useAgentStatesStore: { getState: () => ({ entries: { t1: { state: "working" } } }) },
}));
vi.mock("../terminal/runner", () => ({
  getTerminalBuffer: () => "raw",
  getTerminalSize: () => ({ cols: 80, rows: 24 }),
}));

const { SESSION_TOOLS } = await import("./sessionTools");

const context = { sessionId: "me", requestId: "r1", cwd: "/p", rootPath: "/p" };

describe("SESSION_TOOLS", () => {
  beforeEach(() => {
    mocks.deliver.mockReset();
    mocks.approve.mockReset();
    mocks.autoApprove = "never";
  });

  it("lists the live sessions of this project with agent, kind and state", async () => {
    await expect(SESSION_TOOLS.sessions_list({}, context)).resolves.toBe(
      [
        "me  Lead  Claude Code, terminal, idle (you)",
        "t1  Tests  Claude Code, terminal, working",
        "c1  Docs  Pragma, chat, idle",
      ].join("\n"),
    );
  });

  it("reads a terminal's screen and a chat's last messages", async () => {
    await expect(SESSION_TOOLS.session_read({ session: "t1" }, context)).resolves.toBe(
      "$ claude\n> Fixing the tests",
    );
    await expect(SESSION_TOOLS.session_read({ session: "c1", lines: 1 }, context)).resolves.toBe(
      "assistant: Done.",
    );
  });

  it("refuses its own session and sessions of other projects", async () => {
    await expect(SESSION_TOOLS.session_read({ session: "me" }, context)).rejects.toThrow("own");
    await expect(SESSION_TOOLS.session_read({ session: "x1" }, context)).rejects.toThrow(
      "No session x1",
    );
  });

  it("sends a message once the user allows it", async () => {
    mocks.approve.mockResolvedValue(false);
    await expect(
      SESSION_TOOLS.session_send({ session: "t1", message: "Rebase on main" }, context),
    ).resolves.toContain("did not allow");
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.approve.mock.calls[0][1]).toMatchObject({
      toolName: "session_send",
      description: "Rebase on main",
    });
    mocks.autoApprove = "all";
    await expect(
      SESSION_TOOLS.session_send({ session: "t1", message: "Rebase on main" }, context),
    ).resolves.toBe("Typed the message into Tests.");
    expect(mocks.deliver).toHaveBeenCalledWith(
      expect.objectContaining({ id: "t1" }),
      "Rebase on main",
    );
  });
});
