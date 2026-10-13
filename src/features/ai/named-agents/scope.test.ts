import { describe, expect, it } from "vite-plus/test";

import { agentScope, agentsInScope, copyAgentToScope, newAgentId } from "./scope";
import type { Agent } from "./types";
import { isAgentNameUnique } from "./validation";

function agent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "a1",
    name: "Reviewer",
    brief: "Review the diff.",
    engine: { kind: "builtin", provider: "custom", model: "m", baseUrl: "http://localhost:1" },
    folders: ["/ws/docs", "/elsewhere"],
    memory: [{ id: "m1", text: "Prefers small PRs", createdAt: 1, source: "user" }],
    skills: ["release"],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

const project = agent({ id: "project:reviewer", scope: "project", folders: ["/ws/docs"] });

describe("agent scopes", () => {
  it("treats agents without a scope as personal", () => {
    expect(agentScope(agent())).toBe("personal");
    expect(agentScope(project)).toBe("project");
    expect(agentsInScope([agent(), project], "project")).toEqual([project]);
  });

  it("keeps names unique within a scope only", () => {
    const agents = [agent(), project];
    expect(isAgentNameUnique("Reviewer", agentsInScope(agents, "personal"))).toBe(false);
    expect(isAgentNameUnique("Reviewer", agentsInScope([agent()], "project"))).toBe(true);
  });

  it("gives project agents an id from a free file name", () => {
    expect(newAgentId("project", "Reviewer", [project])).toBe("project:reviewer-2");
    expect(newAgentId("project", "Reviewer", [agent({ id: "reviewer" })])).toBe("project:reviewer");
    expect(newAgentId("personal", "Reviewer", [])).not.toMatch(/^project:/);
  });
});

describe("copyAgentToScope", () => {
  it("copies a personal agent to the project without base URL and outside folders", () => {
    const { agent: copy, droppedFolders } = copyAgentToScope(
      agent(),
      "project",
      [agent()],
      "/ws",
      9,
    );
    expect(copy).toMatchObject({
      id: "project:reviewer",
      name: "Reviewer",
      scope: "project",
      engine: { kind: "builtin", provider: "custom", model: "m" },
      folders: ["/ws/docs"],
      skills: ["release"],
      createdAt: 9,
    });
    expect(copy.engine.baseUrl).toBeUndefined();
    expect(copy.memory).toEqual([expect.objectContaining({ text: "Prefers small PRs" })]);
    expect(droppedFolders).toBe(1);
  });

  it("copies a project agent to the personal roster with a free name", () => {
    const { agent: copy } = copyAgentToScope(project, "personal", [agent(), project], "/ws");
    expect(copy.name).toBe("Reviewer 2");
    expect(copy.scope).toBeUndefined();
    expect(copy.id).not.toBe(project.id);
    expect(copy.id).not.toMatch(/^project:/);
  });
});
