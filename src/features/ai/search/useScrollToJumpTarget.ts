import { useEffect } from "react";

import { useTranscriptJumpStore } from "./transcriptSearch";

/// Scrolls the chat to the message a search result opened, once that message is rendered.
export function useScrollToJumpTarget(sessionId: string | null, messageIds: string[]): void {
  const target = useTranscriptJumpStore((state) => state.target);
  const clear = useTranscriptJumpStore((state) => state.clear);
  const present = target !== null && messageIds.includes(target.messageId);

  useEffect(() => {
    if (!target || target.sessionId !== sessionId || !present) return;
    const frame = requestAnimationFrame(() => {
      const element = document.querySelector(`[data-message-id="${CSS.escape(target.messageId)}"]`);
      element?.scrollIntoView({ block: "center" });
      clear();
    });
    return () => cancelAnimationFrame(frame);
  }, [target, sessionId, present, clear]);
}
