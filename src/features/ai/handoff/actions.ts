import { invoke } from "@tauri-apps/api/core";

import { useAIStore, type ChatSession } from "@/shared/stores/ai";

import { sendToAgent } from "../ci/send";
import { createTerminalSession } from "../panes/launch";
import { useAgentStatesStore } from "../state/agentStates";
import { useAgentsPanesStore } from "../panes/store";
import { terminalLaunchCommand } from "../terminal/cliAttention";
import {
  cancelTerminal,
  ensureTerminal,
  getTerminalCliSessionId,
  getTerminalSize,
} from "../terminal/runner";
import { sessionCwd } from "../worktree/cwd";
import { dismissHandoff, setWaitingUntil, useHandoffStore } from "./store";

/** What the agent hears when it picks the work up again, with the other account or after the reset. */
export const CONTINUE_PROMPT =
  "The usage limit interrupted you. Continue exactly where you stopped.";

const DEFAULT_SIZE = { cols: 120, rows: 40 };
/** A moment after the reset, so the CLI's first request lands in the new window. */
const RESET_GRACE_MS = 60_000;

/**
 * Ends the CLI in the pane and resumes its conversation with another account of the same CLI,
 * in the same pane and the same working folder.
 */
export async function continueWithAccount(
  paneRootPath: string,
  leafId: string,
  session: ChatSession,
  targetDir: string | null,
): Promise<void> {
  const cliSessionId = getTerminalCliSessionId(session.id);
  if (!cliSessionId) throw new Error("Pragma does not know this session's id yet");
  const { cliManifests, workEnvironments } = useAIStore.getState();
  const manifest = cliManifests.find((item) => item.id === session.cliProviderId);
  if (!manifest) throw new Error("The CLI of this session is not available");

  await invoke("claude_session_share", {
    sessionId: cliSessionId,
    fromDir: session.cliAccountDir ?? null,
    toDir: targetDir,
  });

  const size = getTerminalSize(session.id) ?? DEFAULT_SIZE;
  cancelTerminal(session.id);
  // The ended session no longer waits for anything; the new one carries the conversation.
  useAgentStatesStore.getState().apply(session.id, "idle");
  dismissHandoff(session.id, "handed-over");
  const next = await createTerminalSession(session.rootPath, manifest, {
    title: session.title,
    environment: { sameEnvironmentAs: session },
    ...(targetDir ? { accountDir: targetDir } : {}),
  });
  // Started before the pane shows it, so the pane picks up this resume instead of a fresh start.
  await ensureTerminal(next.id, {
    command: `${terminalLaunchCommand(manifest.id, manifest.command)} --resume ${cliSessionId} "${CONTINUE_PROMPT}"`,
    cwd: sessionCwd(session, workEnvironments, session.rootPath),
    account: targetDir ? { providerId: manifest.id, configDir: targetDir } : null,
    ...size,
  });
  useAgentsPanesStore.getState().assignSession(paneRootPath, leafId, next.id);
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Sends "continue" to the agent once its usage window has reset. */
export function waitForReset(session: ChatSession, resetsAtMs: number): void {
  cancelWait(session.id);
  const at = resetsAtMs + RESET_GRACE_MS;
  setWaitingUntil(session.id, at);
  timers.set(
    session.id,
    setTimeout(
      () => {
        timers.delete(session.id);
        setWaitingUntil(session.id, null);
        void sendToAgent(session, CONTINUE_PROMPT);
      },
      Math.max(0, at - Date.now()),
    ),
  );
}

export function cancelWait(sessionId: string): void {
  const timer = timers.get(sessionId);
  if (timer) clearTimeout(timer);
  timers.delete(sessionId);
  if (useHandoffStore.getState().waitingUntil[sessionId] !== undefined) {
    setWaitingUntil(sessionId, null);
  }
}
