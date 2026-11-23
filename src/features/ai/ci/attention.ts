import { useAgentStatesStore } from "../state/agentStates";
import { environmentAgentSession } from "./send";
import { markFailureAsking } from "./store";

/** Shows the card for a failure and marks the agent as needing you, so rail and pill show it. */
export function askAboutFailure(rootPath: string, environmentId: string, failureKey: string): void {
  markFailureAsking(environmentId, failureKey);
  const session = environmentAgentSession(rootPath, environmentId);
  if (session) useAgentStatesStore.getState().apply(session.id, "needs-you");
}
