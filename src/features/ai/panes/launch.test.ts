import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { CLIManifest } from "@/shared/stores/ai";

import type { StartSessionRequest } from "../sessions/start";

const mocks = vi.hoisted(() => ({
  startSession: vi.fn(),
  replaceLayout: vi.fn(),
  deliverTerminalPrompt: vi.fn(),
}));

vi.mock("../sessions/start", () => ({ startSession: mocks.startSession }));
vi.mock("../children/terminalPrompt", () => ({
  deliverTerminalPrompt: mocks.deliverTerminalPrompt,
}));
vi.mock("./store", () => ({
  useAgentsPanesStore: { getState: () => ({ replaceLayout: mocks.replaceLayout }) },
}));

import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import type { Space } from "@/shared/stores/spaces/model";

import { launchTeam, launchTerminals, teamTitles } from "./launch";

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
    expect(mocks.replaceLayout).toHaveBeenCalledWith("/repo", ["s1", "s2", "s3", "s4"], undefined);
  });

  it("lets every shared instance join the first one's worktree", async () => {
    await launchTerminals("/repo", manifest, 4, "shared");

    const [first, ...rest] = requests();
    expect(first.environment).toBe("worktree");
    for (const request of rest) {
      expect(request.sameEnvironmentAs).toMatchObject({ environmentId: "env-1" });
    }
  });

  it("names every instance after the task and hands it the task", async () => {
    await launchTerminals("/repo", manifest, 3, "isolated", undefined, {
      title: "Fix the login",
      prompt: "Fix the login test",
    });

    expect(requests().map((request) => request.init.title)).toEqual([
      "Fix the login #1",
      "Fix the login #2",
      "Fix the login #3",
    ]);
    expect(mocks.deliverTerminalPrompt.mock.calls).toEqual([
      ["s1", "Fix the login test"],
      ["s2", "Fix the login test"],
      ["s3", "Fix the login test"],
    ]);
  });

  it("starts a mixed team in order and shows all of it in one grid", async () => {
    const codex = { id: "codex", name: "Codex" } as CLIManifest;
    await launchTeam(
      "/repo",
      [
        { manifest, count: 2 },
        { manifest, accountDir: "/work", count: 1 },
        { manifest: codex, count: 2 },
      ],
      "isolated",
    );

    expect(
      requests().map((request) => [request.init.cliProviderId, request.init.cliAccountDir]),
    ).toEqual([
      ["claude", undefined],
      ["claude", undefined],
      ["claude", "/work"],
      ["codex", undefined],
      ["codex", undefined],
    ]);
    expect(mocks.replaceLayout).toHaveBeenCalledWith(
      "/repo",
      ["s1", "s2", "s3", "s4", "s5"],
      undefined,
    );
  });

  it("starts every instance in the checkout", async () => {
    await launchTerminals("/repo", manifest, 2, "checkout");

    expect(requests().map((request) => request.environment)).toEqual(["checkout", "checkout"]);
  });

  describe("while the user switches tabs", () => {
    const space: Space = {
      id: "space",
      name: "repo",
      folders: ["/repo"],
      tabs: [
        { id: "agents-1", name: "Agents", kind: "agents" },
        { id: "agents-2", name: "Agents 2", kind: "agents" },
      ],
      activeTabId: "agents-1",
    };

    beforeEach(() => {
      useOpenRepositoriesStore.setState({ spaces: [space], activeSpaceId: space.id });
    });

    it("puts the grid into the tab the start came from", async () => {
      mocks.startSession.mockImplementationOnce(async () => {
        useOpenRepositoriesStore.setState({ spaces: [{ ...space, activeTabId: "agents-2" }] });
        return { id: "s1", environment: "worktree", environmentId: "env-1" };
      });

      await launchTerminals("/repo", manifest, 2, "isolated");

      expect(mocks.replaceLayout.mock.calls[0]?.[2]).toBe("agents-1");
    });

    it("falls back to the front tab when the start tab was closed meanwhile", async () => {
      mocks.startSession.mockImplementationOnce(async () => {
        useOpenRepositoriesStore.setState({
          spaces: [{ ...space, tabs: space.tabs.slice(1), activeTabId: "agents-2" }],
        });
        return { id: "s1", environment: "worktree", environmentId: "env-1" };
      });

      await launchTerminals("/repo", manifest, 1, "isolated");

      expect(mocks.replaceLayout.mock.calls[0]?.[2]).toBeUndefined();
    });
  });
});

describe("teamTitles", () => {
  it("numbers each agent of a mixed team on its own", () => {
    expect(teamTitles(["Claude Code", "Claude Code", "Codex"])).toEqual([
      "Claude Code #1",
      "Claude Code #2",
      "Codex",
    ]);
  });

  it("numbers a shared task across the whole team", () => {
    expect(teamTitles(["Fix the login", "Fix the login", "Fix the login"])).toEqual([
      "Fix the login #1",
      "Fix the login #2",
      "Fix the login #3",
    ]);
  });

  it("leaves a single agent unnumbered", () => {
    expect(teamTitles(["Codex"])).toEqual(["Codex"]);
  });
});
