import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import {
  expandPromptCommand,
  parsePromptCommand,
  promptCommand,
  promptTemplate,
  serverSlug,
} from "./prompts";
import { parseResourceMention, resourceMention } from "./resources";

describe("prompt commands", () => {
  it("slugs server names", () => {
    expect(serverSlug("GitHub Tools")).toBe("github-tools");
    expect(serverSlug("  ")).toBe("mcp");
    expect(promptCommand("Linear", "triage")).toBe("/linear:triage");
  });

  it("builds a template with required arguments first", () => {
    expect(
      promptTemplate("Git", {
        name: "review",
        arguments: [
          { name: "style", required: false },
          { name: "pr", required: true },
        ],
      }),
    ).toBe('/git:review pr="" style=""');
  });

  it("parses quoted and bare arguments", () => {
    expect(parsePromptCommand('/git:review pr=12 note="needs \\"care\\"" empty=""')).toEqual({
      slug: "git",
      prompt: "review",
      arguments: { pr: "12", note: 'needs "care"' },
    });
    expect(parsePromptCommand("just a question")).toBeNull();
    expect(parsePromptCommand("/help")).toBeNull();
  });
});

describe("expandPromptCommand", () => {
  beforeEach(() => invokeMock.mockReset());

  it("replaces the command with the prompt messages", async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === "mcp_list_servers") {
        return Promise.resolve([{ config: { id: "s1", name: "Git" }, status: "running" }]);
      }
      return Promise.resolve([
        { role: "user", text: "Review PR 12" },
        { role: "user", text: "Be brief" },
      ]);
    });
    await expect(expandPromptCommand("/git:review pr=12", null)).resolves.toBe(
      "Review PR 12\n\nBe brief",
    );
    expect(invokeMock).toHaveBeenCalledWith("mcp_get_prompt", {
      id: "s1",
      name: "review",
      arguments: { pr: "12" },
    });
  });

  it("leaves text alone for servers outside the selection", async () => {
    invokeMock.mockResolvedValue([{ config: { id: "s1", name: "Git" }, status: "running" }]);
    await expect(expandPromptCommand("/git:review", ["other"])).resolves.toBe("/git:review");
  });
});

describe("resource mentions", () => {
  it("round-trips server id and uri", () => {
    const mention = resourceMention("mcp-1", "file:///tmp/a.md");
    expect(parseResourceMention(mention)).toEqual({ serverId: "mcp-1", uri: "file:///tmp/a.md" });
    expect(parseResourceMention("src/main.ts")).toBeNull();
    expect(parseResourceMention("mcp:only")).toBeNull();
  });
});
