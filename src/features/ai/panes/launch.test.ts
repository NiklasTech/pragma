import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { CLIManifest } from "@/shared/stores/ai";

import type { StartSessionRequest } from "../sessions/start";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  replaceLayout: vi.fn(),
}));

vi.mock("../sessions/start", () => ({ startSession: mocks.startSession }));
vi.mock("./store", () => ({
  useAgentsPanesStore: { getState: () => ({ replaceLayout: mocks.replaceLayout }) },
}));

import { launchTerminals } from "./launch";

const manifest = { id: "claude", name: "Claude Code" } as CLIManifest;

function requests(): StartSessionRequest[] {
  return mocks.startSession.mock.calls.map(([, request]) => request as StartSessionRequest);
}

describe("launchTerminals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let next = 0;
    mocks.startSession.mockImplementation(async () => {
      next += 1;
      return { id: `s${next}`, environment: "worktree", environmentId: `env-${next}` };
    });
  });

  it("asks for a new worktree for every isolated instance", async () => {
    await launchTerminals("/repo", manifest, 4, "isolated");

    expect(requests().map((request) => request.environment)).toEqual(Array(4).fill("worktree"));
    expect(mocks.replaceLayout).toHaveBeenCalledWith("/repo", ["s1", "s2", "s3", "s4"]);
  });

  it("lets every shared instance join the first one's worktree", async () => {
    await launchTerminals("/repo", manifest, 4, "shared");

    const [first, ...rest] = requests();
    expect(first.environment).toBe("worktree");
    for (const request of rest) {
      expect(request.sameEnvironmentAs).toMatchObject({ environmentId: "env-1" });
    }
  });

  it("starts every instance in the checkout", async () => {
    await launchTerminals("/repo", manifest, 2, "checkout");

    expect(requests().map((request) => request.environment)).toEqual(["checkout", "checkout"]);
  });
});
