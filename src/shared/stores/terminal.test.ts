import { describe, expect, it } from "vite-plus/test";
import { restorableTerminalState, useTerminalStore } from "./terminal";

describe("useTerminalStore", () => {
  it("adds a session without a ptyId", () => {
    const store = useTerminalStore.getState();

    store.addSession({
      id: "test-session-1",
      name: "Test",
      type: "shell",
      shell: "/bin/zsh",
      panelId: "panel-1",
      isActive: true,
    });

    const session = useTerminalStore.getState().sessions.find((s) => s.id === "test-session-1");
    expect(session).toBeDefined();
    expect(session?.ptyId).toBeUndefined();
    expect(useTerminalStore.getState().activeByPanel["panel-1"]).toBe("test-session-1");
  });

  it("attaches a ptyId to an existing session", () => {
    const store = useTerminalStore.getState();

    store.addSession({
      id: "test-session-2",
      name: "Test",
      type: "shell",
      shell: "/bin/zsh",
      panelId: "panel-1",
      isActive: true,
    });

    store.attachPty("test-session-2", "pty-123");

    const session = useTerminalStore.getState().sessions.find((s) => s.id === "test-session-2");
    expect(session?.ptyId).toBe("pty-123");
  });

  it("creates an initial session only once per panel", () => {
    useTerminalStore.setState({ sessions: [], activeByPanel: {}, lastActiveSessionId: null });
    const store = useTerminalStore.getState();

    store.ensureInitialSession({
      id: "initial-session",
      name: "Terminal",
      type: "shell",
      shell: "/bin/zsh",
      panelId: "panel-1",
      isActive: true,
    });

    expect(useTerminalStore.getState().sessions).toHaveLength(1);
    expect(useTerminalStore.getState().activeByPanel["panel-1"]).toBe("initial-session");

    store.ensureInitialSession({
      id: "second-initial-session",
      name: "Terminal",
      type: "shell",
      shell: "/bin/bash",
      panelId: "panel-1",
      isActive: true,
    });

    expect(useTerminalStore.getState().sessions).toHaveLength(1);
    expect(useTerminalStore.getState().activeByPanel["panel-1"]).toBe("initial-session");

    store.ensureInitialSession({
      id: "other-panel-session",
      name: "Terminal",
      type: "shell",
      shell: "/bin/bash",
      panelId: "panel-2",
      isActive: true,
    });

    expect(useTerminalStore.getState().sessions).toHaveLength(2);
    expect(useTerminalStore.getState().activeByPanel["panel-2"]).toBe("other-panel-session");
  });

  it("moves the active session within the panel when a session is removed", () => {
    useTerminalStore.setState({ sessions: [], activeByPanel: {}, lastActiveSessionId: null });
    const store = useTerminalStore.getState();

    store.addSession({
      id: "s1",
      name: "One",
      type: "shell",
      shell: "/bin/zsh",
      panelId: "panel-1",
      isActive: true,
    });
    store.addSession({
      id: "s2",
      name: "Two",
      type: "shell",
      shell: "/bin/zsh",
      panelId: "panel-1",
      isActive: true,
    });

    expect(useTerminalStore.getState().activeByPanel["panel-1"]).toBe("s2");

    store.removeSession("s2");

    expect(useTerminalStore.getState().activeByPanel["panel-1"]).toBe("s1");

    store.removeSession("s1");

    expect(useTerminalStore.getState().activeByPanel["panel-1"]).toBeUndefined();
  });

  it("moves shell sessions to a new cwd and drops their ptyId", () => {
    useTerminalStore.setState({ sessions: [], activeByPanel: {}, lastActiveSessionId: null });
    const store = useTerminalStore.getState();

    store.addSession({
      id: "shell",
      name: "Shell",
      type: "shell",
      cwd: "/old",
      panelId: "panel-1",
      isActive: true,
    });
    store.addRunSession("proc-1", "Run", "pnpm dev", "panel-1");
    store.attachPty("shell", "pty-1");

    store.moveShellSessionsToCwd("/new");

    const sessions = useTerminalStore.getState().sessions;
    const shell = sessions.find((s) => s.id === "shell");
    expect(shell?.cwd).toBe("/new");
    expect(shell?.ptyId).toBeUndefined();
    expect(sessions.find((s) => s.type === "run")?.cwd).toBeUndefined();
  });
});

describe("restorableTerminalState", () => {
  it("keeps shell tabs without their PTY and drops other session types", () => {
    const state = {
      ...useTerminalStore.getState(),
      sessions: [
        {
          id: "shell",
          name: "Shell",
          type: "shell" as const,
          shell: "/bin/zsh",
          cwd: "/repo/src",
          panelId: "panel-1",
          isActive: true,
          ptyId: "pty-1",
        },
        {
          id: "command",
          name: "Command",
          type: "shell" as const,
          command: "npm test",
          panelId: "panel-1",
          isActive: true,
        },
        {
          id: "run",
          name: "Run",
          type: "run" as const,
          processId: "proc-1",
          panelId: "panel-2",
          isActive: true,
        },
      ],
      activeByPanel: { "panel-1": "shell", "panel-2": "run" },
      lastActiveSessionId: "run",
    };

    expect(restorableTerminalState(state)).toEqual({
      sessions: [
        {
          id: "shell",
          name: "Shell",
          type: "shell",
          shell: "/bin/zsh",
          cwd: "/repo/src",
          panelId: "panel-1",
          isActive: true,
        },
      ],
      activeByPanel: { "panel-1": "shell" },
      lastActiveSessionId: null,
    });
  });
});
