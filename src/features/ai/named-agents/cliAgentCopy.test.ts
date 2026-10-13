import { describe, expect, it } from "vite-plus/test";

import { CLI_AGENT_FOLDERS } from "@/features/ai/cli-folders/sources";

import { parseCliAgent } from "./cliAgentFile";
import { cliAgentToPragma } from "./cliAgentCopy";
import { parseProjectAgent, serializeProjectAgent } from "./projectFile";
import type { Agent } from "./types";

const claude = CLI_AGENT_FOLDERS[0];

function discovered(fileId: string, name: string): Agent {
  const result = parseCliAgent(claude, fileId, "/p", `---\nname: ${name}\n---\n\nReview.\n`, 1);
  if (!result.ok) throw new Error(result.issue.error);
  return result.agent;
}

describe("cliAgentToPragma", () => {
  it("keeps the file id and name and drops the source", () => {
    const agent = discovered("code-reviewer", "code-reviewer");
    const copy = cliAgentToPragma(agent, [agent], 5);
    expect(copy).toMatchObject({
      id: "project:code-reviewer",
      name: "code-reviewer",
      scope: "project",
    });
    expect(copy.source).toBeUndefined();

    const parsed = parseProjectAgent("code-reviewer", "/p", serializeProjectAgent(copy, []), "/ws");
    expect(parsed.ok && parsed.agent).toMatchObject({
      name: "code-reviewer",
      brief: "Review.",
      engine: { kind: "cli", cliProviderId: "anthropic-claude" },
    });
  });

  it("picks a new file id when the file name is not a valid id", () => {
    const agent = discovered("my.agent", "My Agent");
    expect(cliAgentToPragma(agent, [agent]).id).toBe("project:my-agent");
  });
});
