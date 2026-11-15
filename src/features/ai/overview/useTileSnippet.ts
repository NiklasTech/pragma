import { useEffect, useMemo, useState } from "react";
import { Terminal } from "@xterm/xterm";

import type { ChatSession } from "@/shared/stores/ai";

import { getTerminalBuffer, getTerminalSize, subscribeTerminalOutput } from "../terminal/runner";
import { snippetLines } from "./overviewModel";

const LINES = 5;
const REFRESH_MS = 1000;
const COLS = 96;
const ROWS = 30;

function readScreen(term: Terminal): string[] {
  const buffer = term.buffer.active;
  const lines: string[] = [];
  for (let i = 0; i < buffer.length; i++)
    lines.push(buffer.getLine(i)?.translateToString(true) ?? "");
  return lines;
}

function chatSnippet(messages: ChatSession["messages"]): string[] {
  const last = [...messages].reverse().find((message) => message.role === "assistant");
  const text = last?.content ?? messages[messages.length - 1]?.content ?? "";
  return snippetLines(text.split("\n"), LINES);
}

/// The last lines of a session: a CLI's screen, rendered off-screen, or the latest chat reply.
export function useTileSnippet(session: ChatSession): string[] {
  const isTerminal = session.kind === "terminal";
  const sessionId = session.id;
  const messages = session.messages;
  const chatLines = useMemo(
    () => (isTerminal ? [] : chatSnippet(messages)),
    [isTerminal, messages],
  );
  const [screenLines, setScreenLines] = useState<string[]>([]);

  useEffect(() => {
    if (!isTerminal) return;
    // An unopened xterm parses output into its buffer without touching the DOM.
    // Render at the PTY's own width, or the CLI's cursor moves land in the wrong columns.
    const size = getTerminalSize(sessionId);
    const term = new Terminal({
      cols: size?.cols ?? COLS,
      rows: size?.rows ?? ROWS,
      scrollback: 200,
      allowProposedApi: true,
    });
    let dirty = true;
    term.write(getTerminalBuffer(sessionId));
    const unsubscribe = subscribeTerminalOutput(sessionId, (data) => {
      term.write(data);
      dirty = true;
    });
    const refresh = () => {
      const current = getTerminalSize(sessionId);
      if (current && (current.cols !== term.cols || current.rows !== term.rows)) {
        term.resize(current.cols, current.rows);
        dirty = true;
      }
      if (!dirty) return;
      dirty = false;
      // write() parses asynchronously; read once the queued output is in the buffer.
      term.write("", () => {
        const next = snippetLines(readScreen(term), LINES);
        setScreenLines((previous) => (previous.join("\n") === next.join("\n") ? previous : next));
      });
    };
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      unsubscribe();
      term.dispose();
    };
  }, [isTerminal, sessionId]);

  return isTerminal ? screenLines : chatLines;
}
