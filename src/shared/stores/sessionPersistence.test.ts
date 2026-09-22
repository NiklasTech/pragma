import { describe, expect, it } from "vite-plus/test";

import { shouldPersistSession, type SessionPersistSnapshot } from "./sessionPersistence";

function snapshot(overrides: Partial<SessionPersistSnapshot> = {}): SessionPersistSnapshot {
  return { sessionId: "a", title: "Title", status: "ready", ...overrides };
}

describe("shouldPersistSession", () => {
  it("persists when the title changes", () => {
    expect(shouldPersistSession(snapshot({ title: "Old" }), snapshot({ title: "New" }))).toBe(true);
  });

  it("persists when a turn finishes", () => {
    expect(
      shouldPersistSession(snapshot({ status: "streaming" }), snapshot({ status: "ready" })),
    ).toBe(true);
  });

  it("persists when the active session switches", () => {
    expect(shouldPersistSession(snapshot({ sessionId: "a" }), snapshot({ sessionId: "b" }))).toBe(
      true,
    );
  });

  it("does not persist on message-only changes", () => {
    expect(shouldPersistSession(snapshot(), snapshot())).toBe(false);
  });

  it("does not persist without an active session", () => {
    expect(shouldPersistSession(snapshot({ sessionId: null }), snapshot({ sessionId: null }))).toBe(
      false,
    );
  });
});
