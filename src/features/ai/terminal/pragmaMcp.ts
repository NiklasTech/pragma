import { invoke } from "@tauri-apps/api/core";

import { useAIStore } from "@/shared/stores/ai";

const PLAIN_ARG = /^[\w@%+=:,./-]+$/;

function quoteArg(arg: string, windows: boolean): string {
  if (PLAIN_ARG.test(arg)) return arg;
  return windows ? `"${arg}"` : `'${arg.replace(/'/g, "'\\''")}'`;
}

function isWindows(): boolean {
  return typeof navigator !== "undefined" && /Windows/.test(navigator.userAgent);
}

/// Adds Pragma's MCP server to a CLI's launch command, so terminal agents get the same tools as chats.
/// It goes last: `--mcp-config` takes several values and would read a following prompt as a file.
export async function withPragmaMcp(sessionId: string, command: string): Promise<string> {
  const session = useAIStore.getState().chatSessions.find((item) => item.id === sessionId);
  const providerId = session?.cliProviderId;
  if (!providerId || !command) return command;
  try {
    const args = await invoke<string[] | null>("child_session_mcp_config", {
      chatSessionId: sessionId,
      providerId,
    });
    if (!args) return command;
    const windows = isWindows();
    return [command, ...args.map((arg) => quoteArg(arg, windows))].join(" ");
  } catch {
    // Without the bridge the CLI still starts, only without Pragma's tools.
    return command;
  }
}
