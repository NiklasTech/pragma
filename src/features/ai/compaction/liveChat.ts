import { useEffect, type RefObject } from "react";
import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";

export interface LiveChat {
  messages: () => UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  busy: () => boolean;
}

const liveChats = new Map<string, LiveChat>();

export function liveChat(sessionId: string): LiveChat | undefined {
  return liveChats.get(sessionId);
}

/// Lets compaction edit the open chat of a session instead of its stored messages.
export function useLiveChatRegistration(
  sessionId: string | null,
  chatRef: RefObject<UseChatHelpers<UIMessage> | null>,
) {
  useEffect(() => {
    if (!sessionId) return;
    const handle: LiveChat = {
      messages: () => chatRef.current?.messages ?? [],
      setMessages: (messages) => chatRef.current?.setMessages(messages),
      busy: () => {
        const status = chatRef.current?.status;
        return status === "submitted" || status === "streaming";
      },
    };
    liveChats.set(sessionId, handle);
    return () => {
      if (liveChats.get(sessionId) === handle) liveChats.delete(sessionId);
    };
  }, [sessionId, chatRef]);
}
