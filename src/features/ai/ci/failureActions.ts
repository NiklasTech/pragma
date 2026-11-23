import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

import { useAgentStatesStore } from "../state/agentStates";
import type { GhCheck } from "./api";
import { buildFailureMessage, type FailureLog } from "./failureMessage";
import { environmentAgentSession, sendToAgent } from "./send";
import { markFailureHandled, recordCiEvent, useAgentCiStore } from "./store";

/** More logs would not fit the message; the agent can read the rest itself. */
const MAX_LOGS = 3;

const logs = new Map<string, Promise<string>>();

function loadFailureLog(repoPath: string, link: string): Promise<string> {
  let log = logs.get(link);
  if (!log) {
    log = invoke<string>("gh_check_failure_log", { repoPath, link }).catch(() => {
      logs.delete(link);
      return "";
    });
    logs.set(link, log);
  }
  return log;
}

/** The last log lines of the first failed checks that link to a log. */
export async function loadFailureLogs(
  repoPath: string,
  failing: readonly GhCheck[],
): Promise<FailureLog[]> {
  const withLogs = failing.filter((check) => check.link).slice(0, MAX_LOGS);
  return Promise.all(
    withLogs.map(async (check) => ({ check, excerpt: await loadFailureLog(repoPath, check.link) })),
  );
}

/** Hands the environment's CI failure to its agent; false when no agent runs there. */
export async function sendFailureToAgent(
  rootPath: string,
  environmentId: string,
  note?: string,
): Promise<boolean> {
  const ci = useAgentCiStore.getState().byEnvironment[environmentId];
  const status = ci?.status;
  const session = environmentAgentSession(rootPath, environmentId);
  if (!ci || status?.state !== "failing" || !session) return false;

  markFailureHandled(environmentId, status.failureKey);
  const message = buildFailureMessage({
    number: ci.number,
    url: ci.url,
    failing: status.failing,
    total: status.total,
    logs: await loadFailureLogs(rootPath, status.failing),
  });
  await sendToAgent(session, message);
  recordCiEvent(environmentId, "sent", `sent to ${session.title}${note ? `, ${note}` : ""}`);
  return true;
}

/** Puts the card away until the next failure and clears the attention it raised. */
export function ignoreFailure(rootPath: string, environmentId: string): void {
  const status = useAgentCiStore.getState().byEnvironment[environmentId]?.status;
  if (status?.state !== "failing") return;
  markFailureHandled(environmentId, status.failureKey);
  const session = environmentAgentSession(rootPath, environmentId);
  const states = useAgentStatesStore.getState();
  if (session && states.entries[session.id]?.state === "needs-you")
    states.apply(session.id, "idle");
}

export function openCheckLog(link: string): void {
  invoke("open_external_url", { url: link }).catch((err: unknown) => toast.error(String(err)));
}
