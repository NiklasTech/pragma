import {
  getTerminalBuffer,
  getTerminalEntryStatus,
  subscribeTerminalOutput,
  writeTerminal,
} from "../terminal/runner";

const QUIET_MS = 1500;
const MAX_WAIT_MS = 20_000;
const SUBMIT_DELAY_MS = 150;

/// Types the prompt into a starting CLI once its output has settled, then submits it.
export function deliverTerminalPrompt(sessionId: string, prompt: string): void {
  const text = prompt.replace(/\s*\n\s*/g, " ");
  let quietTimer: ReturnType<typeof setTimeout> | undefined;
  let done = false;

  const send = () => {
    if (done) return;
    done = true;
    clearTimeout(quietTimer);
    clearTimeout(deadline);
    unsubscribe();
    if (getTerminalEntryStatus(sessionId) !== "running") return;
    void writeTerminal(sessionId, text).then(() => {
      setTimeout(() => void writeTerminal(sessionId, "\r"), SUBMIT_DELAY_MS);
    });
  };

  const settle = () => {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(send, QUIET_MS);
  };

  const unsubscribe = subscribeTerminalOutput(sessionId, settle);
  const deadline = setTimeout(send, MAX_WAIT_MS);
  if (getTerminalBuffer(sessionId)) settle();
}
