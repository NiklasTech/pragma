import { useEffect } from "react";

import { useAgentStatesStore } from "../state/agentStates";
import { subscribeTerminalLimit } from "../terminal/runner";
import { markLimitHit } from "./store";

/** A CLI that stops at its usage limit needs you: its pane offers how to go on. */
export function useHandoffFeed(): void {
  useEffect(
    () =>
      subscribeTerminalLimit((sessionId) => {
        markLimitHit(sessionId);
        useAgentStatesStore.getState().apply(sessionId, "needs-you");
      }),
    [],
  );
}
