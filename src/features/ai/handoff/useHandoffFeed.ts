import { useEffect } from "react";

import { useSettingsStore } from "@/shared/stores/settings";

import { useAgentStatesStore } from "../state/agentStates";
import { subscribeTerminalLimit } from "../terminal/runner";
import { markLimitHit } from "./store";
import { switchOnLimit } from "./switchOnLimit";

function ask(sessionId: string): void {
  markLimitHit(sessionId);
  useAgentStatesStore.getState().apply(sessionId, "needs-you");
}

/** Goes on with another account, or lets the pane ask how to, as Settings › Agents says. */
export async function handleLimit(sessionId: string): Promise<void> {
  const mode = useSettingsStore.getState().agent.limitHandoff;
  if (mode === "off") return;
  if (mode === "switch" && (await switchOnLimit(sessionId).catch(() => false))) return;
  ask(sessionId);
}

/** A CLI that stops at its usage limit goes on with another account, or its pane asks how to. */
export function useHandoffFeed(): void {
  useEffect(() => subscribeTerminalLimit((sessionId) => void handleLimit(sessionId)), []);
}
