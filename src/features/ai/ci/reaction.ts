import { useSettingsStore } from "@/shared/stores/settings";

import { askAboutFailure } from "./attention";
import { sendFailureToAgent } from "./failureActions";
import { environmentAgentSession } from "./send";
import type { CiStatus } from "./status";
import { fixesUsed, recordCiEvent, setFixes, useAgentCiStore } from "./store";

function recordTransition(
  environmentId: string,
  previous: CiStatus | null | undefined,
  next: CiStatus | null,
): void {
  if (!next) return;
  if (next.state === "failing" && previous?.failureKey !== next.failureKey) {
    recordCiEvent(environmentId, "fail", `${next.failing.length} of ${next.total} checks failed`);
  } else if (next.state === "pending" && previous?.state !== "pending") {
    recordCiEvent(environmentId, "run", "CI running");
  } else if (next.state === "passing" && previous?.state !== "passing") {
    recordCiEvent(environmentId, "pass", "CI passed");
  }
}

/** Answers a change in an agent pull request's CI the way Settings › Agents says. */
export async function reactToCi(
  rootPath: string,
  environmentId: string,
  number: number,
  previous: CiStatus | null | undefined,
  next: CiStatus | null,
): Promise<void> {
  recordTransition(environmentId, previous, next);
  if (next?.state === "passing") setFixes(environmentId, null);
  if (next?.state !== "failing") return;

  const { handled, asking } = useAgentCiStore.getState();
  if (handled[environmentId] === next.failureKey || asking[environmentId] === next.failureKey) {
    return;
  }
  const { ciFailure, ciFixTries } = useSettingsStore.getState().agent;
  if (ciFailure === "off") return;

  if (ciFailure === "fix") {
    // Checks still running may fail too; one message with all failures saves a try.
    if (next.pending > 0) return;
    const used = fixesUsed(environmentId, number);
    const agent = environmentAgentSession(rootPath, environmentId);
    if (used < ciFixTries && agent) {
      if (await sendFailureToAgent(rootPath, environmentId, `try ${used + 1}`)) {
        setFixes(environmentId, { number, count: used + 1 });
        return;
      }
    }
  }
  askAboutFailure(rootPath, environmentId, next.failureKey);
}

/** Ends the fixes on their own for the pull request; the next failure asks you. */
export function stopFixing(environmentId: string, number: number): void {
  const count = useAgentCiStore.getState().fixes[environmentId]?.count ?? 0;
  setFixes(environmentId, { number, count, stopped: true });
}
