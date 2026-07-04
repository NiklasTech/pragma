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
      isActive: true,
    });

    const session = useTerminalStore.getState().sessions.find((s) => s.id === "test-session-1");
    expect(session).toBeDefined();
    expect(session?.ptyId).toBeUndefined();
  });

  it("attaches a ptyId to an existing session", () => {
    const store = useTerminalStore.getState();

    store.addSession({
      id: "test-session-2",
      name: "Test",
      type: "shell",
      shell: "/bin/zsh",
      isActive: true,
    });

    store.attachPty("test-session-2", "pty-123");

    const session = useTerminalStore.getState().sessions.find((s) => s.id === "test-session-2");
    expect(session?.ptyId).toBe("pty-123");
  });

  it("creates an initial session only when none exist", () => {
    useTerminalStore.setState({ sessions: [], activeSessionId: null });
    const store = useTerminalStore.getState();

    store.ensureInitialSession({
      id: "initial-session",
      name: "Terminal",
      type: "shell",
      shell: "/bin/zsh",
      isActive: true,
    });

    expect(useTerminalStore.getState().sessions).toHaveLength(1);
    expect(useTerminalStore.getState().activeSessionId).toBe("initial-session");

    store.ensureInitialSession({
      id: "second-initial-session",
      name: "Terminal",
      type: "shell",
      shell: "/bin/bash",
      isActive: true,
    });

    expect(useTerminalStore.getState().sessions).toHaveLength(1);
    expect(useTerminalStore.getState().activeSessionId).toBe("initial-session");
  });
});
