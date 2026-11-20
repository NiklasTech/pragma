import { useEffect, useState } from "react";

import type { ChatSession } from "@/shared/stores/ai";

import { getTerminalBuffer, subscribeTerminalOutput } from "../../terminal/runner";
import { lastTerminalLines } from "./activityModel";

const READ_INTERVAL_MS = 250;

function replyLines(session: ChatSession, count: number): string[] {
  const reply = [...session.messages].reverse().find((message) => message.role === "assistant");
  return (reply?.content ?? "")
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, count);
}

/// The last lines a terminal printed, read at most four times a second, or the start of the last reply.
export function useOutputTail(session: ChatSession, count: number): string[] {
  const terminal = session.kind === "terminal";
  const [lines, setLines] = useState<string[]>(() =>
    terminal ? lastTerminalLines(getTerminalBuffer(session.id), count) : [],
  );
  useEffect(() => {
    if (!terminal) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      timer = null;
      setLines(lastTerminalLines(getTerminalBuffer(session.id), count));
    };
    read();
    const unsubscribe = subscribeTerminalOutput(session.id, () => {
      timer ??= setTimeout(read, READ_INTERVAL_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [terminal, session.id, count]);
  return terminal ? lines : replyLines(session, count);
}
