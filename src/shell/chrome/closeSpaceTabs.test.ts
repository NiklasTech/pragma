import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(() => Promise.resolve(null)) }));

import { createLeaf, createTabs } from "@/features/ai/panes/operations";
import { SHELL_PROVIDER_ID } from "@/features/ai/terminal/shell";
import type { ChatSession } from "@/shared/stores/ai";

import { isBusy, sessionsOnlyIn } from "./closeSpaceTabs";

const tree = (...ids: string[]) => ({
  root: createTabs(ids.map((id) => createLeaf(id))),
  focusedLeafId: null,
  focusOrder: [],
});

const session = (cliProviderId: string): ChatSession => ({
  id: "s",
  rootPath: "/a",
  title: "s",
  kind: "terminal",
  cliProviderId,
  messages: [],
  createdAt: 0,
  updatedAt: 0,
});

describe("sessionsOnlyIn", () => {
  it("leaves out sessions another tab shows too", () => {
    const trees = { one: tree("a", "shared"), two: tree("shared", "b") };
    expect(sessionsOnlyIn(["one"], trees)).toEqual(["a"]);
    expect(sessionsOnlyIn(["one", "two"], trees)).toEqual(["a", "shared", "b"]);
    expect(sessionsOnlyIn(["unknown"], trees)).toEqual([]);
  });
});

describe("isBusy", () => {
  it("counts an agent in a turn or a question", () => {
    const agent = session("anthropic-claude");
    expect(isBusy(agent, "working", false)).toBe(true);
    expect(isBusy(agent, "needs-you", false)).toBe(true);
    expect(isBusy(agent, "done", false)).toBe(false);
    expect(isBusy(agent, undefined, false)).toBe(false);
  });

  it("counts a shell only while it runs a program", () => {
    const shell = session(SHELL_PROVIDER_ID);
    expect(isBusy(shell, "needs-you", false)).toBe(false);
    expect(isBusy(shell, undefined, true)).toBe(true);
  });
});
