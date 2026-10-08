import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";
import {
  useTerminalStore,
  type TerminalSession as TerminalSessionType,
} from "@/shared/stores/terminal";
import { useTerminalSuggestions } from "@/shared/hooks/useTerminalSuggestions";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTheme } from "@/theme";
import { getXtermTheme } from "@/shared/lib/theme/xterm-theme";
import { AISuggestionsOverlay } from "./ai-suggestions";
import { TerminalFindBar } from "./TerminalFindBar";
import { ArrowDown } from "@phosphor-icons/react";
import { safePtyInvoke } from "../safePtyInvoke";
import { useTerminalSetup } from "../hooks/useTerminalSetup";
import { useTerminalInput } from "../hooks/useTerminalInput";
import { useTerminalCommands, useTerminalSelection } from "../hooks/useTerminalEvents";
import { useTerminalFind } from "../hooks/useTerminalFind";
import { useCopyOnSelect, useTerminalCursor } from "../hooks/useTerminalPreferences";
import { useTerminalFileDrop } from "../hooks/useTerminalFileDrop";
import { useShellIntegration } from "../hooks/useShellIntegration";
import { CommandFailureBar } from "./CommandFailureBar";
import { quotePathsForShell } from "../shellQuote";

interface TerminalSessionProps {
  session: TerminalSessionType;
  isActive: boolean;
}

export function TerminalSession({ session, isActive }: TerminalSessionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
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
  const lineHeight = useSettingsStore((s) => s.terminal.lineHeight);
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
    lineHeight,
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

  useTerminalCursor(termState);
  useCopyOnSelect(termState);

  const find = useTerminalFind(termState, rootRef);
  const shellIntegration = useShellIntegration(termState, rootRef);

  const insertPaths = useCallback(
    (paths: string[]) => {
      const ptyId = ptyIdRef.current;
      if (!ptyId) return;
      const shell = session.shell || useTerminalStore.getState().defaultShell;
      safePtyInvoke(invoke("write_pty", { id: ptyId, data: quotePathsForShell(paths, shell) }));
      termRef.current?.focus();
    },
    [session.shell],
  );
  const drop = useTerminalFileDrop({ targetRef: rootRef, enabled: isActive, onPaths: insertPaths });

  return (
    <div
      ref={rootRef}
      data-terminal-find
      className="relative h-full w-full bg-terminal-bg py-2 pr-2"
      style={{ display: isActive ? "block" : "none" }}
      {...drop.handlers}
    >
      {drop.over && (
        <div
          className="pointer-events-none absolute inset-1 z-30 rounded-md border-2 border-primary bg-primary/10"
          aria-hidden="true"
        />
      )}
      {find.open && (
        <TerminalFindBar
          search={find.search}
          focusRequest={find.focusRequest}
          onClose={find.close}
        />
      )}
      <div ref={containerRef} className="relative h-full w-full overflow-hidden [&>.xterm]:pl-2">
        <AISuggestionsOverlay
          suggestion={suggestions.suggestion}
          loading={suggestions.loading}
          visible={suggestions.visible}
        />
      </div>
      <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
        {shellIntegration.failure && (
          <CommandFailureBar
            command={shellIntegration.failure}
            onDismiss={shellIntegration.dismissFailure}
          />
        )}
        {showScrollDown && (
          <button
            type="button"
            onClick={() => termRef.current?.scrollToBottom()}
            className="flex size-7 items-center justify-center rounded-full border border-border bg-bg-elevated text-fg-muted shadow-md transition-colors hover:text-fg-default"
            title="Scroll to Bottom"
          >
            <ArrowDown size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
