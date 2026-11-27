import { invoke } from "@tauri-apps/api/core";

import { useAIStore } from "@/shared/stores/ai";

/** CLIs that load extra MCP servers from a config file given at launch. */
const MCP_CONFIG_FLAG: Record<string, string> = {
  "anthropic-claude": "--mcp-config",
};

function quotePath(path: string, windows: boolean): string {
  return windows ? `"${path}"` : `'${path.replace(/'/g, "'\\''")}'`;
}

function isWindows(): boolean {
  return typeof navigator !== "undefined" && /Windows/.test(navigator.userAgent);
}

/// Adds Pragma's MCP server to a CLI's launch command, so terminal agents get the same tools as chats.
/// It goes last: `--mcp-config` takes several values and would read a following prompt as a file.
export async function withPragmaMcp(sessionId: string, command: string): Promise<string> {
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  const flag = session?.cliProviderId ? MCP_CONFIG_FLAG[session.cliProviderId] : undefined;
  if (!flag || !command) return command;
  try {
    const path = await invoke<string>("child_session_mcp_config", { chatSessionId: sessionId });
    return `${command} ${flag} ${quotePath(path, isWindows())}`;
  } catch {
    // Without the bridge the CLI still starts, only without Pragma's tools.
    return command;
  }
}
