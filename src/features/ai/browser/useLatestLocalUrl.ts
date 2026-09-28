import { useEffect, useMemo, useState } from "react";

import type { ChatSession } from "@/shared/stores/ai";

import { getTerminalBuffer, subscribeTerminalOutput } from "../terminal/runner";
import { findLatestLocalUrl } from "./detect";

const SCAN_DELAY_MS = 250;
// A chunk can split a URL, so each scan re-reads a tail of the buffer.
const SCAN_TAIL_CHARS = 16_384;

function useTerminalLocalUrl(sessionId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setUrl(null);
      return;
    }
    setUrl(findLatestLocalUrl(getTerminalBuffer(sessionId)));

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeTerminalOutput(sessionId, () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const found = findLatestLocalUrl(getTerminalBuffer(sessionId).slice(-SCAN_TAIL_CHARS));
        if (found) setUrl(found);
      }, SCAN_DELAY_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [sessionId]);

  return url;
}

/// The latest local URL a terminal printed or a conversation mentioned.
export function useLatestLocalUrl(session: ChatSession | undefined): string | null {
  const terminalUrl = useTerminalLocalUrl(session?.kind === "terminal" ? session.id : null);
  const messages = session?.kind === "terminal" ? undefined : session?.messages;
  const conversationUrl = useMemo(() => {
    if (!messages) return null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const found = findLatestLocalUrl(messages[index].content);
      if (found) return found;
    }
    return null;
  }, [messages]);

  return session?.kind === "terminal" ? terminalUrl : conversationUrl;
}
