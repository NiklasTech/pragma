import { describe, expect, it } from "vite-plus/test";

import {
  AGENT_TOOL_DEFINITIONS,
  AGENT_TOOL_NAMES,
  isAgentTool,
  isDestructiveAgentTool,
} from "./tools";

describe("agent tool name resolution", () => {
  it("recognizes all defined agent tools", () => {
    for (const name of Object.values(AGENT_TOOL_NAMES)) {
      expect(isAgentTool(name)).toBe(true);
    }
  });

  it("rejects MCP-style and unknown tool names", () => {
    expect(isAgentTool("filesystem__read_file")).toBe(false);
    expect(isAgentTool("agent_delete_everything")).toBe(false);
    expect(isAgentTool("")).toBe(false);
  });

  it("flags only write_file and run_command as destructive", () => {
    expect(isDestructiveAgentTool(AGENT_TOOL_NAMES.writeFile)).toBe(true);
    expect(isDestructiveAgentTool(AGENT_TOOL_NAMES.runCommand)).toBe(true);
    expect(isDestructiveAgentTool(AGENT_TOOL_NAMES.readFile)).toBe(false);
    expect(isDestructiveAgentTool(AGENT_TOOL_NAMES.listFiles)).toBe(false);
    expect(isDestructiveAgentTool(AGENT_TOOL_NAMES.taskComplete)).toBe(false);
  });

  it("provides a definition for every agent tool", () => {
    const defined = AGENT_TOOL_DEFINITIONS.map((def) => def.function.name);
    expect(defined.sort()).toEqual(Object.values(AGENT_TOOL_NAMES).sort());
  });
});
