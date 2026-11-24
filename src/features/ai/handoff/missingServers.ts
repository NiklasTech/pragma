import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { sessionCwd } from "../worktree/cwd";

/** The MCP servers the session would lose with the other account; none when that is unknown. */
export async function missingMcpServers(
  session: ChatSession,
  targetDir: string | null,
): Promise<string[]> {
  const folder = sessionCwd(session, useAIStore.getState().workEnvironments, session.rootPath);
  try {
    return await invoke<string[]>("claude_mcp_missing", {
      fromDir: session.cliAccountDir ?? null,
      toDir: targetDir,
      folder,
    });
  } catch {
    return [];
  }
}

/** "2 MCP servers missing there: github, linear", or null when none is. */
export function missingServersLabel(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  const servers = names.length === 1 ? "1 MCP server" : `${names.length} MCP servers`;
  return `${servers} missing there: ${names.join(", ")}`;
}

/** The missing servers per account folder, read while the handoff card is open. */
export function useMissingMcpServers(
  session: ChatSession,
  targetDirs: readonly (string | null)[],
  open: boolean,
): Record<string, string[]> {
  const [missing, setMissing] = useState<Record<string, string[]>>({});
  const key = JSON.stringify(targetDirs);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    const dirs = JSON.parse(key) as (string | null)[];
    void Promise.all(
      dirs.map(async (dir) => [dir ?? "", await missingMcpServers(session, dir)] as const),
    ).then((entries) => {
      if (!stale) setMissing(Object.fromEntries(entries));
    });
    return () => {
      stale = true;
    };
  }, [session, key, open]);

  return missing;
}
