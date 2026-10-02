/// Output this long after the last keystroke counts as the echo of typing, not agent work.
export const TYPING_ECHO_MS = 400;
/// A terminal stays active this long after its last output.
export const ACTIVITY_HOLD_MS = 1500;

export function isAgentOutput(now: number, lastInputAt: number): boolean {
  return now - lastInputAt > TYPING_ECHO_MS;
}
