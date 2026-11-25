import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

import { summarizeAgentStates, useAgentStatesStore } from "./agentStates";

/// Tells the backend how many agents work, so quitting asks first while any do.
export function useWorkingAgentsReport(): void {
  useEffect(() => {
    let reported = 0;
    const report = () => {
      const count = summarizeAgentStates(useAgentStatesStore.getState().entries).working.length;
      if (count === reported) return;
      reported = count;
      invoke("set_working_agents", { count }).catch(() => {});
    };
    report();
    return useAgentStatesStore.subscribe(report);
  }, []);
}
