export const STOP_KILL_WINDOW_MS = 2000;

export type TerminalStopDecision = "interrupt" | "kill";

export function decideTerminalStop(
  lastInterruptAt: number | null,
  now: number,
  windowMs = STOP_KILL_WINDOW_MS,
): TerminalStopDecision {
  if (lastInterruptAt !== null && now - lastInterruptAt < windowMs) return "kill";
  return "interrupt";
}
