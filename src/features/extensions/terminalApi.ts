import { invoke } from "@tauri-apps/api/core";

import { resolveDefaultTerminalPanelId } from "@/shared/lib/terminal-panels";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useLayoutStore } from "@/shell/layout";

const PTY_WAIT_MS = 10_000;
const PTY_POLL_MS = 100;
const MAX_TEXT_LENGTH = 64 * 1024;
const MAX_NAME_LENGTH = 60;

// An extension may only write to the terminals it created.
const owned = new Map<string, Set<string>>();

function joinWorkspacePath(root: string, relative: string): string {
  const parts = relative.replace(/\\/g, "/").split("/");
  if (relative.startsWith("/") || /^[a-zA-Z]:/.test(relative) || parts.includes("..")) {
    throw new Error("cwd must be a path inside the workspace");
  }
  const clean = parts.filter((part) => part && part !== ".").join("/");
  return clean ? `${root.replace(/[\\/]+$/, "")}/${clean}` : root;
}

export function createExtensionTerminal(
  extensionId: string,
  workspaceRoot: string | null,
  options: { name?: string; cwd?: string },
): { id: string } {
  if (options.name !== undefined && options.name.length > MAX_NAME_LENGTH) {
    throw new Error(`"name" must be at most ${MAX_NAME_LENGTH} characters`);
  }
  const cwd =
    options.cwd !== undefined && workspaceRoot
      ? joinWorkspacePath(workspaceRoot, options.cwd)
      : (workspaceRoot ?? undefined);

  const layout = useLayoutStore.getState();
  if (layout.terminal.mode === "hidden") layout.toggleTerminal();

  const id = crypto.randomUUID();
  useTerminalStore.getState().addSession({
    id,
    name: options.name ?? extensionId,
    type: "shell",
    cwd,
    panelId: resolveDefaultTerminalPanelId(),
    isActive: true,
  });
  const ids = owned.get(extensionId) ?? new Set<string>();
  ids.add(id);
  owned.set(extensionId, ids);
  return { id };
}

/// The terminal's PTY starts once its view mounts, so writes wait for it.
async function waitForPty(sessionId: string): Promise<string> {
  const deadline = Date.now() + PTY_WAIT_MS;
  while (Date.now() < deadline) {
    const session = useTerminalStore.getState().sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error("The terminal was closed");
    if (session.ptyId) return session.ptyId;
    await new Promise((resolve) => setTimeout(resolve, PTY_POLL_MS));
  }
  throw new Error("The terminal did not start in time");
}

export async function sendExtensionTerminalText(
  extensionId: string,
  terminalId: string,
  text: string,
  addNewLine: boolean,
): Promise<void> {
  if (!owned.get(extensionId)?.has(terminalId)) {
    throw new Error("Unknown terminal; extensions can only write to terminals they created");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`"text" must be at most ${MAX_TEXT_LENGTH} characters`);
  }
  const ptyId = await waitForPty(terminalId);
  await invoke("write_pty", { id: ptyId, data: addNewLine ? `${text}\n` : text });
}

export function forgetExtensionTerminals(extensionId: string): void {
  owned.delete(extensionId);
}
