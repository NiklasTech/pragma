import type { BackendToolDefinition } from "@/shared/lib/ai/protocol";
import { useSettingsStore, type AgentSettings } from "@/shared/stores/settings";
import type { AgentToolCall, AgentToolResult } from "@/features/agent/executor";
import type { AgentApprovalDecision } from "@/features/agent/permissions";
import type { AgentRunContext } from "@/features/agent/runContext";

import { callExtension } from "./calls";
import { useExtensionsStore, type RegisteredAgentTool } from "./store";
import { getAgentSettings } from "@/shared/stores/workspaceSettings/effective";

const PREFIX = "ext__";
const SEPARATOR = "__";
// Provider APIs accept tool names of at most 64 characters.
const MAX_TOOL_NAME = 64;
const TOOL_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 50_000;

export function extensionToolName(extensionId: string, name: string): string {
  return `${PREFIX}${extensionId}${SEPARATOR}${name}`;
}

export function findExtensionTool(
  toolName: string,
  tools: RegisteredAgentTool[] = useExtensionsStore.getState().agentTools,
): RegisteredAgentTool | undefined {
  if (!toolName.startsWith(PREFIX)) return undefined;
  return tools.find((tool) => extensionToolName(tool.extensionId, tool.name) === toolName);
}

export function isExtensionTool(toolName: string): boolean {
  return findExtensionTool(toolName) !== undefined;
}

export function extensionToolDefinitions(tools: RegisteredAgentTool[]): BackendToolDefinition[] {
  return tools
    .filter((tool) => extensionToolName(tool.extensionId, tool.name).length <= MAX_TOOL_NAME)
    .map((tool) => ({
      type: "function",
      function: {
        name: extensionToolName(tool.extensionId, tool.name),
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
}

/// The approval rule of Pragma's own non-file tools: read-only tools run, others ask
/// unless the user auto-approves everything.
export function resolveExtensionToolApproval(
  tool: Pick<RegisteredAgentTool, "readOnly">,
  settings: AgentSettings,
  yoloMode: boolean,
): AgentApprovalDecision {
  if (tool.readOnly || yoloMode || settings.autoApprove === "all") return "auto";
  return "required";
}

function formatOutput(result: unknown): string {
  const text = typeof result === "string" ? result : JSON.stringify(result ?? null, null, 2);
  return text.length > MAX_OUTPUT_CHARS
    ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n... [truncated]`
    : text;
}

export async function runExtensionTool(
  call: AgentToolCall,
  context: AgentRunContext,
): Promise<AgentToolResult> {
  const tool = findExtensionTool(call.toolName);
  if (!tool) return { errorText: `Tool ${call.toolName} is not available` };

  const label = `${tool.extensionId}: ${tool.name}`;
  context.addStep({ id: call.toolCallId, toolName: call.toolName, label, status: "running" });
  if (context.isCancelled()) {
    context.updateStep(call.toolCallId, { status: "denied" });
    return { errorText: "Agent was stopped by the user." };
  }

  const settings = useSettingsStore.getState();
  if (resolveExtensionToolApproval(tool, getAgentSettings(), settings.ai.yoloMode) === "required") {
    const approved = await context.requestApproval({
      toolCallId: call.toolCallId,
      toolName: label,
      args: call.input,
      description: tool.description,
    });
    if (!approved) {
      context.updateStep(call.toolCallId, { status: "denied" });
      return { errorText: "The user denied this action. Continue without it or finish the task." };
    }
  }

  try {
    const result = await callExtension(
      tool.extensionId,
      "tool.call",
      { name: tool.name, input: call.input ?? {} },
      TOOL_TIMEOUT_MS,
    );
    context.updateStep(call.toolCallId, { status: "done" });
    return { output: formatOutput(result) };
  } catch (err) {
    const errorText = err instanceof Error ? err.message : String(err);
    context.updateStep(call.toolCallId, { status: "error", detail: errorText });
    return { errorText };
  }
}
