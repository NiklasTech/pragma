import type { AgentSettings } from "@/shared/stores/settings";

import { AGENT_TOOL_NAMES, isDestructiveAgentTool } from "./tools";

export type AgentApprovalDecision = "auto" | "required";

// A pattern matches when it equals the command, when the command extends it
// with arguments ("pnpm test" allows "pnpm test --run"), or when it ends in
// "*", acting as a plain prefix ("cargo *" allows "cargo check").
export function matchesCommandPattern(command: string, pattern: string): boolean {
  const cmd = command.trim();
  const pat = pattern.trim();
  if (!cmd || !pat) return false;

  if (pat.endsWith("*")) {
    const prefix = pat.slice(0, -1).trimEnd();
    return prefix.length > 0 && cmd.startsWith(prefix);
  }

  return cmd === pat || cmd.startsWith(`${pat} `);
}

export function isCommandAllowed(command: string, allowedCommands: string[]): boolean {
  return allowedCommands.some((pattern) => matchesCommandPattern(command, pattern));
}

function readCommandInput(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const command = (input as { command?: unknown }).command;
  return typeof command === "string" ? command : "";
}

export function resolveAgentApproval(
  toolName: string,
  input: unknown,
  settings: AgentSettings,
  yoloMode: boolean,
): AgentApprovalDecision {
  if (!isDestructiveAgentTool(toolName)) return "auto";
  if (yoloMode || settings.autoApprove === "all") return "auto";

  if (toolName === AGENT_TOOL_NAMES.runCommand) {
    return isCommandAllowed(readCommandInput(input), settings.allowedCommands)
      ? "auto"
      : "required";
  }

  return settings.autoApprove === "edits" ? "auto" : "required";
}
