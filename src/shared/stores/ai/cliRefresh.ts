import { useAIStore } from "@/shared/stores/ai";
import { loadCliAccounts } from "@/shared/stores/ai/cliAccounts";

/** CLIs are checked again at most this often; one check runs every installed CLI once. */
export const CLI_REFRESH_INTERVAL_MS = 5000;

let lastRun = Number.NEGATIVE_INFINITY;
let running: Promise<void> | null = null;

/// Checks the coding CLIs again, so one installed while Pragma runs shows up without a
/// restart. Calls within the interval, or while a check runs, reuse that check.
export function refreshCLIStatuses(now: number = Date.now()): Promise<void> {
  if (running) return running;
  if (now - lastRun < CLI_REFRESH_INTERVAL_MS) return Promise.resolve();
  lastRun = now;
  running = Promise.all([useAIStore.getState().loadCLIStatuses(), loadCliAccounts()])
    .then(() => {})
    .finally(() => {
      running = null;
    });
  return running;
}

/** For tests: forget the last check. */
export function resetCLIRefresh(): void {
  lastRun = Number.NEGATIVE_INFINITY;
  running = null;
}
