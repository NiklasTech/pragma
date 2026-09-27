import { invoke } from "@tauri-apps/api/core";

import type { Agent } from "./types";

export async function loadAgentRoster(): Promise<Agent[]> {
  return invoke<Agent[]>("agents_load");
}

export async function saveAgentRoster(agents: Agent[]): Promise<void> {
  await invoke("agents_save", { req: { agents } });
}
