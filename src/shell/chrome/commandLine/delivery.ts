import { useEffect } from "react";
import { create } from "zustand";

import { writeTerminal } from "@/features/ai/terminal/runner";
import type { ChatSession } from "@/shared/stores/ai";

interface PendingMessage {
  sessionId: string;
  text: string;
}

interface DeliveryState {
  pending: PendingMessage | null;
}

/// A message from the command line waiting for the chat of its session to send it.
export const useCommandLineDeliveryStore = create<DeliveryState>()(() => ({ pending: null }));

/// Sends a line to an agent: typed into a terminal, or handed to the session's chat.
export function deliverToSession(session: ChatSession, text: string): void {
  if (session.kind === "terminal") {
    void writeTerminal(session.id, `${text}\r`);
    return;
  }
  useCommandLineDeliveryStore.setState({ pending: { sessionId: session.id, text } });
}

/// Lets a mounted chat send what the command line handed to its session; the first chat to see it
/// takes it, so a session shown twice sends once.
export function useCommandLineDelivery(
  sessionId: string | null,
  send: (text: string) => void,
): void {
  const pending = useCommandLineDeliveryStore((state) => state.pending);
  useEffect(() => {
    if (!pending || !sessionId || pending.sessionId !== sessionId) return;
    if (useCommandLineDeliveryStore.getState().pending !== pending) return;
    useCommandLineDeliveryStore.setState({ pending: null });
    send(pending.text);
  }, [pending, send, sessionId]);
}
