import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";
import {
  useTerminalStore,
  type TerminalSession as TerminalSessionType,
} from "@/shared/stores/terminal";
import { useTerminalSuggestions } from "@/shared/hooks/useTerminalSuggestions";
import { useTheme } from "@/theme";
import { getXtermTheme } from "@/shared/lib/theme/xterm-theme";
import { AISuggestionsOverlay } from "./ai-suggestions";
import { ArrowDown } from "@phosphor-icons/react";
import { safePtyInvoke } from "../safePtyInvoke";
import { useTerminalSetup } from "../hooks/useTerminalSetup";
import { useTerminalInput } from "../hooks/useTerminalInput";
import { useTerminalCommands, useTerminalSelection } from "../hooks/useTerminalEvents";

interface TerminalSessionProps {
  session: TerminalSessionType;
  isActive: boolean;
}

export function TerminalSession({ session, isActive }: TerminalSessionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const pendingDa1Ref = useRef(false);
  const lastOutputRef = useRef<string>("");
  const [termState, setTermState] = useState<XTerm | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const lastActivityMarkRef = useRef(0);
  const fontSize = useTerminalStore((s) => s.fontSize);
  const fontFamily = useTerminalStore((s) => s.fontFamily);
  const fontId = useTerminalStore((s) => s.fontId);
  const scrollback = useTerminalStore((s) => s.scrollback);
  const aiSuggestions = useTerminalStore((s) => s.aiSuggestions);
  const terminalFontFamily = fontId || fontFamily;
  const { themeId, resolvedMode } = useTheme();

  const suggestions = useTerminalSuggestions({
    term: termState,
    ptyId: ptyIdRef.current,
    enabled: aiSuggestions,
    cwd: session.cwd ?? null,
    lastOutputRef,
  });

  useTerminalSetup({
    session,
    containerRef,
    termRef,
    fitRef,
    ptyIdRef,
    pendingDa1Ref,
    lastOutputRef,
    lastActivityMarkRef,
    setTermState,
    setShowScrollDown,
    fontSize,
    terminalFontFamily,
    scrollback,
  });

  useEffect(() => {
    if (session.ptyId) {
      ptyIdRef.current = session.ptyId;
    }
  }, [session.ptyId]);

  useEffect(() => {
    if (!termRef.current) return;

    // Defer reading CSS variables until the theme provider has updated
    // the document root styles in the current render frame.
    const frame = requestAnimationFrame(() => {
      if (!termRef.current) return;
      termRef.current.options.theme = getXtermTheme();
      termRef.current.refresh(0, termRef.current.rows - 1);
    });

    return () => cancelAnimationFrame(frame);
  }, [themeId, resolvedMode]);

  useEffect(() => {
    if (isActive && termRef.current && fitRef.current) {
      termRef.current.focus();
      fitRef.current.fit();
      const { cols, rows } = termRef.current;
      if (ptyIdRef.current && cols > 0 && rows > 0) {
        safePtyInvoke(invoke("resize_pty", { id: ptyIdRef.current, rows, cols }));
      }
    }
  }, [isActive]);

  useTerminalSelection(termState);

  useTerminalInput({ containerRef, termRef, ptyIdRef, termState, suggestions, fontSize });

  useTerminalCommands(termRef, isActive);

  return (
    <div
      className="relative h-full w-full bg-terminal-bg p-2"
      style={{ display: isActive ? "block" : "none" }}
    >
      <div ref={containerRef} className="relative h-full w-full overflow-hidden">
        <AISuggestionsOverlay
          suggestion={suggestions.suggestion}
          loading={suggestions.loading}
          visible={suggestions.visible}
        />
      </div>
      {showScrollDown && (
        <button
          type="button"
          onClick={() => termRef.current?.scrollToBottom()}
          className="absolute bottom-4 right-4 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted shadow-md transition-colors hover:text-fg-default"
          title="Scroll to Bottom"
        >
          <ArrowDown size={13} />
        </button>
      )}
    </div>
  );
}
