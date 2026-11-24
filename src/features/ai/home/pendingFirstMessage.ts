interface PendingFirstMessage {
  text: string;
  /** The chat it belongs to; without one, the next chat that opens sends it. */
  sessionId: string | null;
}

let pending: PendingFirstMessage | null = null;

export function setPendingFirstMessage(text: string, sessionId: string | null = null): void {
  pending = { text, sessionId };
}

export function takePendingFirstMessage(sessionId: string): string | null {
  if (!pending || (pending.sessionId !== null && pending.sessionId !== sessionId)) return null;
  const { text } = pending;
  pending = null;
  return text;
}

export function clearPendingFirstMessage(): void {
  pending = null;
}
