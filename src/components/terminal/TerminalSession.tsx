import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { useTerminalStore, type TerminalSession as TerminalSessionType } from "@/stores/terminal";
import { useTerminalSuggestions } from "@/hooks/useTerminalSuggestions";
import { AISuggestionsOverlay } from "./ai-suggestions";

interface PtyOutputEvent {
  id: string;
  data: string;
}

interface TerminalSessionProps {
  session: TerminalSessionType;
  isActive: boolean;
}

export function TerminalSession({ session, isActive }: TerminalSessionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const lastOutputRef = useRef<string>("");
  const [termState, setTermState] = useState<XTerm | null>(null);
  const { fontSize, fontFamily, scrollback, aiSuggestions } = useTerminalStore();

  const suggestions = useTerminalSuggestions({
    term: termState,
    ptyId: ptyIdRef.current,
    enabled: aiSuggestions,
    cwd: session.cwd ?? null,
    lastOutputRef,
  });

  useEffect(() => {
    let disposed = false;
    let unlistenFn: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    async function setup() {
      if (!containerRef.current) return;

      await document.fonts.ready;
      if (disposed) return;

      const t = new XTerm({
        fontSize,
        fontFamily,
        cursorBlink: true,
        cursorStyle: "block",
        convertEol: true,
        scrollback,
        theme: {
          background: "#0d0e15",
          foreground: "#c0caf5",
          cursor: "#c0caf5",
          selectionBackground: "#283457",
        },
      });
      const fit = new FitAddon();
      fitRef.current = fit;
      t.loadAddon(fit);
      t.open(containerRef.current);
      termRef.current = t;
      setTermState(t);

      const unlisten = await listen<PtyOutputEvent>("pty_output", (event) => {
        if (event.payload.id === ptyIdRef.current) {
          t.write(event.payload.data);
          lastOutputRef.current = (lastOutputRef.current + event.payload.data).slice(-1000);
        }
      });
      unlistenFn = unlisten;

      fit.fit();
      const { cols, rows } = t;

      try {
        let ptyId: string;
        if (session.command) {
          ptyId = await invoke<string>("create_pty_command", {
            command: session.command,
            cwd: session.cwd ?? null,
            cols: Math.max(cols, 10),
            rows: Math.max(rows, 2),
          });
        } else {
          const shellArg = session.shell?.trim().length ? session.shell : undefined;
          ptyId = await invoke<string>("create_pty", {
            shell: shellArg,
            cols: Math.max(cols, 10),
            rows: Math.max(rows, 2),
          });
        }
        if (disposed) return;
        ptyIdRef.current = ptyId;
      } catch (err) {
        t.writeln(`\r\nFailed to start shell: ${String(err)}`);
        return;
      }

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          resizeTimer = null;
          fit.fit();
          const { cols: newCols, rows: newRows } = t;
          if (newCols > 0 && newRows > 0 && ptyIdRef.current) {
            void invoke("resize_pty", {
              id: ptyIdRef.current,
              rows: newRows,
              cols: newCols,
            });
          }
        }, 120);
      });
      resizeObserver.observe(containerRef.current);

      requestAnimationFrame(() => {
        fit.fit();
        const { cols: rafCols, rows: rafRows } = t;
        if (rafCols > 0 && rafRows > 0 && ptyIdRef.current) {
          void invoke("resize_pty", { id: ptyIdRef.current, rows: rafRows, cols: rafCols });
        }
      });
      setTimeout(() => {
        fit.fit();
        const { cols: toCols, rows: toRows } = t;
        if (toCols > 0 && toRows > 0 && ptyIdRef.current) {
          void invoke("resize_pty", { id: ptyIdRef.current, rows: toRows, cols: toCols });
        }
      }, 100);
    }

    void setup();

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      unlistenFn?.();
      resizeObserver?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
      if (ptyIdRef.current) {
        void invoke("kill_pty", { id: ptyIdRef.current });
      }
      ptyIdRef.current = null;
    };
  }, [session.command, session.shell, session.cwd, fontSize, fontFamily, scrollback]);

  useEffect(() => {
    if (isActive && termRef.current && fitRef.current) {
      termRef.current.focus();
      fitRef.current.fit();
      const { cols, rows } = termRef.current;
      if (ptyIdRef.current && cols > 0 && rows > 0) {
        void invoke("resize_pty", { id: ptyIdRef.current, rows, cols });
      }
    }
  }, [isActive]);

  useEffect(() => {
    if (!termState) return;

    const handleData = suggestions.handleData;
    const disposable = termState.onData((data) => {
      if (data === "\t") return;

      if (!handleData(data) && ptyIdRef.current) {
        void invoke("write_pty", { id: ptyIdRef.current, data });
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [termState, suggestions.handleData]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const activeElement = document.activeElement;
      if (!activeElement || !container.contains(activeElement)) return;

      event.preventDefault();
      event.stopPropagation();

      if (suggestions.visible) {
        suggestions.accept();
      } else if (ptyIdRef.current) {
        void invoke("write_pty", { id: ptyIdRef.current, data: "\t" });
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [suggestions.visible, suggestions.accept]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden"
      style={{ display: isActive ? "block" : "none" }}
    >
      <AISuggestionsOverlay
        suggestion={suggestions.suggestion}
        loading={suggestions.loading}
        visible={suggestions.visible}
      />
    </div>
  );
}
