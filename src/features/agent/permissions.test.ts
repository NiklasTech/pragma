import { describe, expect, it } from "vite-plus/test";

import type { AgentSettings } from "@/shared/stores/settings";

import { isCommandAllowed, matchesCommandPattern, resolveAgentApproval } from "./permissions";
import { AGENT_TOOL_NAMES } from "./tools";

const baseSettings: AgentSettings = {
  enabled: true,
  autoApprove: "never",
  allowedCommands: [],
};

describe("matchesCommandPattern", () => {
  it("matches an exact command", () => {
    expect(matchesCommandPattern("pnpm test", "pnpm test")).toBe(true);
  });

  it("matches a command with extra arguments", () => {
    expect(matchesCommandPattern("pnpm test --run", "pnpm test")).toBe(true);
  });

  it("does not match a different command sharing a prefix", () => {
    expect(matchesCommandPattern("pnpm testbed", "pnpm test")).toBe(false);
  });

  it("matches a prefix when the pattern ends with a wildcard", () => {
    expect(matchesCommandPattern("cargo check --all", "cargo *")).toBe(true);
    expect(matchesCommandPattern("git status", "cargo *")).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(matchesCommandPattern("  pnpm test  ", " pnpm test ")).toBe(true);
  });

  it("rejects empty commands and patterns", () => {
    expect(matchesCommandPattern("", "pnpm")).toBe(false);
    expect(matchesCommandPattern("pnpm", "")).toBe(false);
    expect(matchesCommandPattern("pnpm", "*")).toBe(false);
  });
});

describe("isCommandAllowed", () => {
  it("matches against any configured pattern", () => {
    const allowed = ["pnpm test", "cargo *"];
    expect(isCommandAllowed("cargo build", allowed)).toBe(true);
    expect(isCommandAllowed("rm -rf build", allowed)).toBe(false);
  });
});

describe("resolveAgentApproval", () => {
  it("always auto-approves read-only tools", () => {
    expect(resolveAgentApproval(AGENT_TOOL_NAMES.readFile, {}, baseSettings, false)).toBe("auto");
    expect(resolveAgentApproval(AGENT_TOOL_NAMES.listFiles, {}, baseSettings, false)).toBe("auto");
    expect(resolveAgentApproval(AGENT_TOOL_NAMES.taskComplete, {}, baseSettings, false)).toBe(
      "auto",
    );
  });

  it("requires approval for writes when autoApprove is never", () => {
    expect(
      resolveAgentApproval(AGENT_TOOL_NAMES.writeFile, { path: "a.ts" }, baseSettings, false),
    ).toBe("required");
  });

  it("auto-approves writes when autoApprove is edits", () => {
    const settings: AgentSettings = { ...baseSettings, autoApprove: "edits" };
    expect(resolveAgentApproval(AGENT_TOOL_NAMES.writeFile, {}, settings, false)).toBe("auto");
    expect(
      resolveAgentApproval(AGENT_TOOL_NAMES.runCommand, { command: "ls" }, settings, false),
    ).toBe("required");
  });

  it("auto-approves everything when autoApprove is all", () => {
    const settings: AgentSettings = { ...baseSettings, autoApprove: "all" };
    expect(
      resolveAgentApproval(AGENT_TOOL_NAMES.runCommand, { command: "rm -rf /" }, settings, false),
    ).toBe("auto");
  });

  it("auto-approves destructive tools in yolo mode", () => {
    expect(resolveAgentApproval(AGENT_TOOL_NAMES.writeFile, {}, baseSettings, true)).toBe("auto");
    expect(
      resolveAgentApproval(AGENT_TOOL_NAMES.runCommand, { command: "ls" }, baseSettings, true),
    ).toBe("auto");
  });

  it("auto-approves commands matching allowedCommands even when autoApprove is never", () => {
    const settings: AgentSettings = { ...baseSettings, allowedCommands: ["pnpm test"] };
    expect(
      resolveAgentApproval(
        AGENT_TOOL_NAMES.runCommand,
        { command: "pnpm test -- --watch" },
        settings,
        false,
      ),
    ).toBe("auto");
    expect(
      resolveAgentApproval(
        AGENT_TOOL_NAMES.runCommand,
        { command: "pnpm publish" },
        settings,
        false,
      ),
    ).toBe("required");
  });
});
