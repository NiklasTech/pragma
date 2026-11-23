import { useAgentStatesStore } from "../state/agentStates";
import { environmentAgentSession } from "./send";
import type { CiStatus } from "./status";
import { useAgentCiStore } from "./store";

/** A new CI failure marks the environment's agent as needing you, so rail and pill show it. */
export function noticeCiFailure(
  rootPath: string,
  environmentId: string,
  previous: CiStatus | null | undefined,
  next: CiStatus | null,
): void {
  if (next?.state !== "failing" || previous?.failureKey === next.failureKey) return;
  if (useAgentCiStore.getState().handled[environmentId] === next.failureKey) return;
  const session = environmentAgentSession(rootPath, environmentId);
  if (session) useAgentStatesStore.getState().apply(session.id, "needs-you");
}
