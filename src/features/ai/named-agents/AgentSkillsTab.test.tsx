import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";

import { AgentSkillsTab } from "./AgentSkillsTab";
import type { Agent } from "./types";

const agent: Agent = {
  id: "agent-1",
  name: "Reviewer",
  brief: "Review.",
  engine: { kind: "builtin" },
  folders: [],
  memory: [],
  skills: [],
  createdAt: 1,
  updatedAt: 1,
};

describe("AgentSkillsTab", () => {
  it("offers to create a skill when the workspace has none", () => {
    const html = renderToStaticMarkup(<AgentSkillsTab agent={agent} />);
    expect(html).toContain("New skill");
    expect(html).toContain("No skills in this workspace");
  });
});
