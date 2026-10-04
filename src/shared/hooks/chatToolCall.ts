import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";

import { callMcpTool, type McpChatTool } from "@/shared/lib/ai/mcpTools";
import { getMessageText, getToolInvocation } from "@/shared/lib/ai/protocol";
import { executeAgentToolCall, type AgentToolCall } from "@/features/agent/executor";
import { shouldAgentContinue } from "@/features/agent/loop";
import { foregroundRunContext } from "@/features/agent/runContext";
import { useAgentStore } from "@/features/agent/store";
import { isAgentTool } from "@/features/agent/tools";
import { isExtensionTool, runExtensionTool } from "@/features/extensions/agentTools";
import type { AgentAccess } from "@/features/ai/named-agents/folders";

interface ChatToolCallOptions {
  acpActive: boolean;
  cwd: string;
  agentAccess: AgentAccess | null;
  resolveTool: (displayName: string) => McpChatTool | undefined;
}

export async function runChatToolCall(
  chat: UseChatHelpers<UIMessage>,
  toolCall: AgentToolCall,
  { acpActive, cwd, agentAccess, resolveTool }: ChatToolCallOptions,
): Promise<void> {
  // ACP agents execute tools themselves via reverse-RPC; the frontend only displays results.
  if (acpActive) {
    return;
  }

  if (isAgentTool(toolCall.toolName)) {
    await executeAgentToolCall(chat, cwd, toolCall, agentAccess);
    return;
  }

  if (isExtensionTool(toolCall.toolName)) {
    const result = await runExtensionTool(toolCall, foregroundRunContext);
    if ("errorText" in result) {
      chat.addToolOutput({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        state: "output-error",
        errorText: result.errorText,
      });
    } else {
      chat.addToolOutput({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: result.output,
      });
    }
    return;
  }

  const tool = resolveTool(toolCall.toolName);
  if (!tool) {
    chat.addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: `Tool ${toolCall.toolName} is not available`,
    });
    return;
  }

  const result = await callMcpTool(tool, toolCall.input);
  if ("errorText" in result) {
    chat.addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: result.errorText,
    });
  } else {
    chat.addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: result.output,
    });
  }
}

export function shouldAutoContinueChat(messages: UIMessage[]): boolean {
  // Agent Mode keeps iterating on tool outputs until the model calls
  // agent_task_complete. A step limit applies only when the user set one.
  const agentState = useAgentStore.getState();
  if (agentState.modeActive) {
    if (agentState.status !== "running" && agentState.status !== "waiting-approval") {
      return false;
    }
    return shouldAgentContinue(messages, agentState.maxSteps);
  }

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") return false;

  // Only auto-continue when the assistant message contains a completed tool
  // call but has not produced an answer yet. Once the model generated text,
  // we must not resubmit to avoid an infinite loop.
  if (getMessageText(lastMessage).trim().length > 0) return false;

  return lastMessage.parts.some((part) => {
    const inv = getToolInvocation(part);
    if (!inv) return false;
    return inv.state === "output-available" || inv.state === "output-error";
  });
}
