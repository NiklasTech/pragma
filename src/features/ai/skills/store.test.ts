import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { Skill } from "./types";

const mocks = vi.hoisted(() => ({
  loadWorkspaceSkills: vi.fn(),
  loadCliSkills: vi.fn(async () => []),
}));

vi.mock("./storage", () => ({
  loadWorkspaceSkills: mocks.loadWorkspaceSkills,
  writeSkillEnabled: vi.fn(),
}));
vi.mock("./cliStorage", () => ({ loadCliSkills: mocks.loadCliSkills }));

import { repositorySkills, useSkillsStore } from "./store";

function skill(id: string, rootPath: string): Skill {
  return {
    id,
    path: `${rootPath}/.pragma/skills/${id}.md`,
    name: id,
    description: "",
    enabled: true,
    error: null,
  };
}

const skillsByRoot: Record<string, Skill[]> = {
  "/a": [skill("deploy", "/a")],
  "/b": [skill("release", "/b")],
};

function ids(skills: readonly Skill[] | undefined): string[] {
  return (skills ?? []).map((item) => item.id);
}

describe("skills of several repositories", () => {
  beforeEach(() => {
    mocks.loadWorkspaceSkills.mockReset();
    mocks.loadWorkspaceSkills.mockImplementation(
      async (rootPath: string) => skillsByRoot[rootPath],
    );
    useSkillsStore.setState({ rootPath: null, skills: [], byRoot: {} });
  });

  it("loads another repository without changing the active skills", async () => {
    await useSkillsStore.getState().loadSkills("/a");
    await useSkillsStore.getState().loadRepositorySkills("/b");

    const state = useSkillsStore.getState();
    expect(state.rootPath).toBe("/a");
    expect(ids(state.skills)).toEqual(["deploy"]);
    expect(ids(state.byRoot["/a"])).toEqual(["deploy"]);
    expect(ids(state.byRoot["/b"])).toEqual(["release"]);
  });

  it("reads a repository once and serves it from the cache", async () => {
    expect(ids(await repositorySkills("/b"))).toEqual(["release"]);
    expect(ids(await repositorySkills("/b"))).toEqual(["release"]);
    expect(mocks.loadWorkspaceSkills).toHaveBeenCalledTimes(1);
  });

  it("reloads the given repository, or the active one without a root", async () => {
    await useSkillsStore.getState().loadSkills("/a");
    mocks.loadWorkspaceSkills.mockClear();

    await useSkillsStore.getState().reloadSkills("/b");
    expect(mocks.loadWorkspaceSkills).toHaveBeenLastCalledWith("/b");
    expect(useSkillsStore.getState().rootPath).toBe("/a");

    await useSkillsStore.getState().reloadSkills();
    expect(mocks.loadWorkspaceSkills).toHaveBeenLastCalledWith("/a");
  });
});
