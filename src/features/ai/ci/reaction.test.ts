import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChatSession } from "@/shared/stores/ai";
import type { AgentCiFailure } from "@/shared/stores/settings";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  ask: vi.fn(),
  agent: null as ChatSession | null,
  mode: "ask" as AgentCiFailure,
  tries: 2,
}));

vi.mock("@/shared/stores/settings", () => ({
  useSettingsStore: {
    getState: () => ({ agent: { ciFailure: mocks.mode, ciFixTries: mocks.tries } }),
  },
}));
vi.mock("./failureActions", () => ({ sendFailureToAgent: mocks.send }));
vi.mock("./attention", () => ({ askAboutFailure: mocks.ask }));
vi.mock("./send", () => ({ environmentAgentSession: () => mocks.agent }));

import { reactToCi, stopFixing } from "./reaction";
import { ciStatus, type CiStatus } from "./status";
import { useAgentCiStore } from "./store";

const agent: ChatSession = {
  id: "s1",
  rootPath: "/repo",
  title: "Claude Code",
  messages: [],
  createdAt: 0,
  updatedAt: 0,
  kind: "terminal",
  environmentId: "env-1",
};

function run(...buckets: string[]): CiStatus | null {
  return ciStatus(
    buckets.map((bucket, index) => ({
      name: `check ${index}`,
      workflow: "CI",
      bucket,
      link: `https://x/${bucket}/${index}/${Math.random()}`,
    })),
  );
}

function history(): string[] {
  return (useAgentCiStore.getState().history["env-1"] ?? []).map((event) => event.text);
}

describe("reactToCi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agent = agent;
    mocks.mode = "ask";
    mocks.tries = 2;
    mocks.send.mockResolvedValue(true);
    useAgentCiStore.setState({
      byEnvironment: {},
      handled: {},
      asking: {},
      fixes: {},
      history: {},
    });
  });

  it("asks about a new failure, once", async () => {
    const failed = run("fail", "pass");
    await reactToCi("/repo", "env-1", 42, null, failed);
    expect(mocks.ask).toHaveBeenCalledWith("/repo", "env-1", failed?.failureKey);
    expect(mocks.send).not.toHaveBeenCalled();

    useAgentCiStore.setState({ asking: { "env-1": failed!.failureKey } });
    await reactToCi("/repo", "env-1", 42, failed, failed);
    expect(mocks.ask).toHaveBeenCalledTimes(1);
  });

  it("does nothing when set to do nothing", async () => {
    mocks.mode = "off";
    await reactToCi("/repo", "env-1", 42, null, run("fail"));
    expect(mocks.ask).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("fixes on its own once every check is done, then asks after the last try", async () => {
    mocks.mode = "fix";
    await reactToCi("/repo", "env-1", 42, null, run("fail", "pending"));
    expect(mocks.send).not.toHaveBeenCalled();

    await reactToCi("/repo", "env-1", 42, null, run("fail", "pass"));
    expect(mocks.send).toHaveBeenLastCalledWith("/repo", "env-1", "try 1");
    await reactToCi("/repo", "env-1", 42, null, run("fail", "pass"));
    expect(mocks.send).toHaveBeenLastCalledWith("/repo", "env-1", "try 2");
    expect(useAgentCiStore.getState().fixes["env-1"]).toEqual({ number: 42, count: 2 });

    await reactToCi("/repo", "env-1", 42, null, run("fail", "pass"));
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.ask).toHaveBeenCalledTimes(1);
  });

  it("starts counting again for a new pull request and after CI passed", async () => {
    mocks.mode = "fix";
    mocks.tries = 1;
    await reactToCi("/repo", "env-1", 42, null, run("fail"));
    await reactToCi("/repo", "env-1", 43, null, run("fail"));
    expect(mocks.send).toHaveBeenCalledTimes(2);

    await reactToCi("/repo", "env-1", 43, null, run("pass"));
    expect(useAgentCiStore.getState().fixes["env-1"]).toBeUndefined();
    await reactToCi("/repo", "env-1", 43, null, run("fail"));
    expect(mocks.send).toHaveBeenCalledTimes(3);
  });

  it("asks instead when you stopped the fixes or no agent runs", async () => {
    mocks.mode = "fix";
    stopFixing("env-1", 42);
    await reactToCi("/repo", "env-1", 42, null, run("fail"));
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.ask).toHaveBeenCalledTimes(1);

    mocks.agent = null;
    await reactToCi("/repo", "env-1", 50, null, run("fail"));
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.ask).toHaveBeenCalledTimes(2);
  });

  it("keeps a short history of what CI did", async () => {
    const pending = run("pending");
    const failed = run("fail", "pass");
    await reactToCi("/repo", "env-1", 42, null, pending);
    await reactToCi("/repo", "env-1", 42, pending, pending);
    await reactToCi("/repo", "env-1", 42, pending, failed);
    await reactToCi("/repo", "env-1", 42, failed, run("pass"));
    expect(history()).toEqual(["CI running", "1 of 2 checks failed", "CI passed"]);
  });
});
