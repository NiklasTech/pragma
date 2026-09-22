export interface SessionPersistSnapshot {
  sessionId: string | null;
  title: string | null;
  status: string;
}

export function shouldPersistSession(
  previous: SessionPersistSnapshot,
  current: SessionPersistSnapshot,
): boolean {
  if (current.sessionId === null) return false;
  if (previous.sessionId !== current.sessionId) return true;
  if (previous.title !== current.title) return true;

  const wasStreaming = previous.status === "streaming" || previous.status === "submitted";
  return wasStreaming && current.status === "ready";
}
