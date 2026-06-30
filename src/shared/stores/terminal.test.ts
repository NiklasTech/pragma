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
});
