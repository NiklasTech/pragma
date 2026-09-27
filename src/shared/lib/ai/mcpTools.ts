import { invoke } from "@tauri-apps/api/core";

import type { BackendToolDefinition } from "./protocol";

export interface McpChatTool {
  serverId: string;
  toolName: string;
  displayName: string;
  description: string;
  parameters: unknown;
}

interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: unknown;
}

interface McpCallResult {
  content: unknown;
  is_error?: boolean;
  error?: string;
}

export function toolDisplayName(serverId: string, toolName: string): string {
  return `${serverId}__${toolName}`;
}

export function mcpToolDefinition(tool: McpChatTool): BackendToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.displayName,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

/// One snapshot of the running MCP servers' tools, for runs that live outside a React tree.
export async function loadMcpChatTools(): Promise<McpChatTool[]> {
  const servers = await invoke<Array<{ config: { id: string } }>>("mcp_list_servers");
  const tools: McpChatTool[] = [];
  for (const server of servers) {
    const serverId = server.config.id;
    try {
      const listed = await invoke<McpToolInfo[]>("mcp_list_tools", { id: serverId });
      for (const tool of listed) {
        tools.push({
          serverId,
          toolName: tool.name,
          displayName: toolDisplayName(serverId, tool.name),
          description: tool.description,
          parameters: tool.inputSchema ?? {},
        });
      }
    } catch {
      // A server that is not running yet contributes no tools.
    }
  }
  return tools;
}

export async function callMcpTool(
  tool: Pick<McpChatTool, "serverId" | "toolName">,
  input: unknown,
): Promise<{ output: string } | { errorText: string }> {
  try {
    const result = await invoke<McpCallResult>("mcp_call_tool", {
      id: tool.serverId,
      toolName: tool.toolName,
      arguments: typeof input === "object" ? input : {},
    });
    const output =
      typeof result.content === "string" ? result.content : JSON.stringify(result.content);
    if (result.is_error || result.error) return { errorText: result.error ?? output };
    return { output };
  } catch (err) {
    return { errorText: String(err) };
  }
}
