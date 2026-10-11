import { toast } from "sonner";

import {
  engineCanChat,
  resolveEffectiveEngine,
  type EngineAuth,
  type EngineDefaults,
} from "@/shared/lib/ai/sessionEngine";
import { useAIStore, type AgentEngine, type CLIManifest } from "@/shared/stores/ai";
import { useLayoutStore } from "@/shell/layout/store";

export const NO_TASK_ENGINE_MESSAGE = "No AI provider or coding CLI is set up";

export type TaskEngineState = EngineDefaults & EngineAuth & { cliManifests: CLIManifest[] };

function canRun(engine: AgentEngine, state: TaskEngineState): boolean {
  return engineCanChat(resolveEffectiveEngine(engine, state), state);
}

/// The engine a task runs on: the assigned agent's, else the chat's selection, else a signed-in CLI.
export function pickTaskEngine(
  agentEngine: AgentEngine | undefined,
  state: TaskEngineState,
): AgentEngine | null {
  if (agentEngine) return canRun(agentEngine, state) ? agentEngine : null;

  const active: AgentEngine = state.activeCLIProvider
    ? { kind: "cli", cliProviderId: state.activeCLIProvider }
    : { kind: "builtin" };
  const fallbacks = state.cliManifests
    .filter((manifest) => manifest.uses_acp && state.cliStatuses[manifest.id]?.installed === true)
    .map((manifest): AgentEngine => ({ kind: "cli", cliProviderId: manifest.id }));
  return [active, ...fallbacks].find((engine) => canRun(engine, state)) ?? null;
}

export function taskEngine(agentEngine: AgentEngine | undefined): AgentEngine | null {
  return pickTaskEngine(agentEngine, useAIStore.getState());
}

export function toastNoTaskEngine(): void {
  toast.error(NO_TASK_ENGINE_MESSAGE, {
    action: {
      label: "Open Settings",
      onClick: () => useLayoutStore.getState().addFloatingPanel("settings"),
    },
  });
}
