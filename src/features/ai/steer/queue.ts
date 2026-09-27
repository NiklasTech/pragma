export type StopIntent = "cancel" | "steer";

export interface SubmitDecision {
  action: "queue" | "replace" | "ignore";
  queued: string | null;
  restore: string | null;
}

export interface RemoveDecision {
  action: "remove";
  queued: null;
  restore: null;
}

export function decideSubmit(current: string | null, raw: string): SubmitDecision {
  const text = raw.trim();
  if (!text) return { action: "ignore", queued: current, restore: null };
  if (current === null) return { action: "queue", queued: text, restore: null };
  return { action: "replace", queued: text, restore: current };
}

export function decideRemove(): RemoveDecision {
  return { action: "remove", queued: null, restore: null };
}

export function decideStopIntent(queued: string | null): StopIntent {
  return queued === null ? "cancel" : "steer";
}

export function shouldFlush(input: {
  queued: string | null;
  chatFailed: boolean;
  ownedRun: boolean;
  runFailed: boolean;
}): boolean {
  if (input.queued === null || input.chatFailed) return false;
  return !(input.ownedRun && input.runFailed);
}
