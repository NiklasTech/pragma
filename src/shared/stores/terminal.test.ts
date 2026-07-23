import { describe, expect, it } from "vite-plus/test";
import { useTerminalStore } from "./terminal";

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
});
