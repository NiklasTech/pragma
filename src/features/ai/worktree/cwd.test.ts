import { describe, expect, it } from "vite-plus/test";

import type { WorkEnvironment } from "@/shared/stores/ai";

import { sessionCwd, sessionEnvironment } from "./cwd";

const ROOT = "/workspace";

function environment(overrides: Partial<WorkEnvironment> = {}): WorkEnvironment {
  return {
    id: "env-1",
    kind: "worktree",
    path: "/data/worktrees/env-1",
    branch: "pragma/env1",
    setupStatus: "ready",
    setupLog: "",
    ...overrides,
  };
}

describe("sessionCwd", () => {
  it("uses the workspace root without an environment", () => {
    expect(sessionCwd(undefined, [environment()], ROOT)).toBe(ROOT);
    expect(sessionCwd({}, [environment()], ROOT)).toBe(ROOT);
  });

  it("resolves the path of the referenced environment", () => {
    const environments = [environment(), environment({ id: "env-2", path: "/other" })];

    expect(sessionCwd({ environmentId: "env-2" }, environments, ROOT)).toBe("/other");
  });

  it("resolves the same path for two sessions that share an environment", () => {
    const environments = [environment()];
    const first = { environmentId: "env-1" };
    const second = { environmentId: "env-1" };

    expect(sessionCwd(first, environments, ROOT)).toBe("/data/worktrees/env-1");
    expect(sessionCwd(second, environments, ROOT)).toBe(sessionCwd(first, environments, ROOT));
  });

  it("falls back to the workspace root when the setup failed", () => {
    const environments = [environment({ setupStatus: "error" })];

    expect(sessionCwd({ environmentId: "env-1" }, environments, ROOT)).toBe(ROOT);
  });

  it("falls back to the workspace root when the environment is gone", () => {
    expect(sessionCwd({ environmentId: "missing" }, [environment()], ROOT)).toBe(ROOT);
  });
});

describe("sessionEnvironment", () => {
  it("finds the environment by id", () => {
    const shared = environment();

    expect(sessionEnvironment({ environmentId: "env-1" }, [shared])).toBe(shared);
    expect(sessionEnvironment({ environmentId: "env-2" }, [shared])).toBeUndefined();
  });
});
