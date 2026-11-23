import type { GhCheck } from "./api";

export type CiState = "pending" | "failing" | "passing";

export interface CiStatus {
  state: CiState;
  failing: GhCheck[];
  pending: number;
  /** Checks that count: skipped and cancelled ones are left out. */
  total: number;
  /** Names one set of failures, so a new push that fails again reads as a new failure. */
  failureKey: string;
}

/** What the checks of a pull request add up to, or null when none count yet. */
export function ciStatus(checks: readonly GhCheck[]): CiStatus | null {
  // A failing job cancels its siblings, so cancelled checks say nothing on their own.
  const counted = checks.filter(
    (check) => check.bucket !== "skipping" && check.bucket !== "cancel",
  );
  if (counted.length === 0) return null;
  const failing = counted.filter((check) => check.bucket === "fail");
  const pending = counted.filter((check) => check.bucket === "pending").length;
  return {
    state: failing.length > 0 ? "failing" : pending > 0 ? "pending" : "passing",
    failing,
    pending,
    total: counted.length,
    failureKey: failing
      .map((check) => check.link || `${check.workflow}/${check.name}`)
      .sort()
      .join("\n"),
  };
}

export function ciLabel(status: CiStatus): string {
  if (status.state === "failing") return `CI ${status.failing.length} failing`;
  if (status.state === "pending") return "CI running";
  return "CI passed";
}
