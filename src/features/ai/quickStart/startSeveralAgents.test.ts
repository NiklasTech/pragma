import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import type { CLIManifest } from "@/shared/stores/ai";

import { severalStarts } from "./startSeveralAgents";

const claude = { id: "anthropic-claude", name: "Claude Code" } as CLIManifest;

describe("severalStarts", () => {
  it("starts the agent as often as asked, each with the task", () => {
    const starts = severalStarts(claude, 3, "  fix the login  ", "/acc");
    expect(starts).toHaveLength(3);
    expect(starts[2]).toEqual({
      manifest: claude,
      accountDir: "/acc",
      task: { title: "Claude Code", prompt: "fix the login" },
    });
  });

  it("starts them empty without a task", () => {
    expect(severalStarts(claude, 2, "")[0].task).toBeUndefined();
  });
});
