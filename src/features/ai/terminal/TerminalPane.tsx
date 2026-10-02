import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import "@xterm/xterm/css/xterm.css";

import { PRAGMA_PATH_MIME } from "@/shared/lib/pragma-drag";
import { matchShortcut } from "@/shared/lib/shortcuts";
import { fixWebKitDeadKeys } from "@/shared/lib/terminal-dead-keys";
import { getXtermTheme } from "@/shared/lib/theme/xterm-theme";
import { useAIStore, type ChatSession } from "@/shared/stores/ai";
import { useSettingsStore } from "@/shared/stores/settings";
import { useTerminalStore } from "@/shared/stores/terminal";
import { useTheme } from "@/theme";

import { sessionCwd } from "../worktree/cwd";
import { quoteShellPath } from "./buffer";
import {
  ensureTerminal,
  getTerminalBuffer,
  resizeTerminal,
  subscribeTerminalOutput,
  writeTerminal,
} from "./runner";

interface TerminalPaneProps {
  session: ChatSession;
  workspaceRoot: string;
}

export function TerminalPane({ session, workspaceRoot }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fontSize = useTerminalStore((s) => s.fontSize);
  const fontFamily = useTerminalStore((s) => s.fontFamily);
  const fontId = useTerminalStore((s) => s.fontId);
  const scrollback = useTerminalStore((s) => s.scrollback);
  const terminalFontFamily = fontId || fontFamily;
  const { themeId, resolvedMode } = useTheme();
  const cliManifests = useAIStore((state) => state.cliManifests);
  const manifest = session.cliProviderId
    ? cliManifests.find((item) => item.id === session.cliProviderId)
    : undefined;
  const command = manifest?.command ?? "";
  const cwd = sessionCwd(session, workspaceRoot);
  const [dropActive, setDropActive] = useState(false);
  const dictateBinding = useSettingsStore((state) =>
    state.ai.voiceInput ? state.shortcuts["voice.holdToDictate"] : null,
  );
  const dictateBindingRef = useRef(dictateBinding);
  dictateBindingRef.current = dictateBinding;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !command) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const term = new XTerm({
      fontSize,
      fontFamily: `${terminalFontFamily}, Consolas, Courier New, monospace`,
      cursorBlink: true,
      cursorStyle: "block",
      convertEol: true,
      scrollback,
      theme: getXtermTheme(),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(
      new WebLinksAddon((event: MouseEvent, uri: string) => {
        event.preventDefault();
        void invoke("open_external_url", { url: uri });
      }),
    );
    term.open(container);
    const removeDeadKeyFix = fixWebKitDeadKeys(term, container);
    // The hold-to-dictate key belongs to dictation, so xterm must not type it.
    term.attachCustomKeyEventHandler((event) => !matchShortcut(event, dictateBindingRef.current));
    termRef.current = term;

    const replayBase = getTerminalBuffer(session.id);
    const unsubOutput = subscribeTerminalOutput(session.id, (data) => {
      term.write(data);
    });
    const replayNow = getTerminalBuffer(session.id);
    const replay = replayNow.startsWith(replayBase) ? replayNow : replayBase;
    if (replay) term.write(replay);
    const dataDisposable = term.onData((data) => {
      void writeTerminal(session.id, data);
    });

    fit.fit();
    const initialSize = { cols: term.cols, rows: term.rows };
    void ensureTerminal(session.id, {
      command,
      cwd,
      cols: initialSize.cols,
      rows: initialSize.rows,
    });

    resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        fit.fit();
        if (term.cols > 0 && term.rows > 0) {
          void resizeTerminal(session.id, term.cols, term.rows);
        }
      }, 120);
    });
    if (!disposed) resizeObserver.observe(container);

    requestAnimationFrame(() => {
      if (disposed) return;
      fit.fit();
      if (term.cols > 0 && term.rows > 0) {
        void resizeTerminal(session.id, term.cols, term.rows);
      }
    });

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      unsubOutput();
      dataDisposable.dispose();
      removeDeadKeyFix();
      term.dispose();
      termRef.current = null;
    };
  }, [session.id, command, cwd, fontSize, terminalFontFamily, scrollback]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    const frame = requestAnimationFrame(() => {
      if (!termRef.current) return;
      termRef.current.options.theme = getXtermTheme();
      termRef.current.refresh(0, termRef.current.rows - 1);
    });
    return () => cancelAnimationFrame(frame);
  }, [themeId, resolvedMode]);

  return (
    <div
      className="relative h-full w-full bg-terminal-bg p-2"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(PRAGMA_PATH_MIME)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropActive(false);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes(PRAGMA_PATH_MIME)) return;
        event.preventDefault();
        event.stopPropagation();
        setDropActive(false);
        const path = event.dataTransfer.getData(PRAGMA_PATH_MIME);
        if (path) void writeTerminal(session.id, quoteShellPath(path));
      }}
    >
      {dropActive && (
        <div
          className="pointer-events-none absolute inset-1 z-10 rounded-md border-2 border-primary bg-primary/10"
          aria-hidden="true"
        />
      )}
      <div ref={containerRef} className="h-full w-full overflow-hidden" />
    </div>
  );
}
