import { useEffect, useRef, useState } from "react";

function safePtyInvoke<T>(promise: Promise<T>) {
  void promise.catch((err) => {
    // Ignore races where the PTY was destroyed between scheduling and sending.
    if (String(err).includes("PTY not found")) return;
  });
}
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import {
  useTerminalStore,
  type TerminalSession as TerminalSessionType,
} from "@/shared/stores/terminal";
import { useTerminalSuggestions } from "@/shared/hooks/useTerminalSuggestions";
import { useTheme } from "@/theme";
import { useSettingsStore } from "@/shared/stores/settings";
import { getXtermTheme } from "@/shared/lib/theme/xterm-theme";
import { dispatchTerminalSelection } from "@/shared/lib/terminal-events";
import { copyToClipboard, readFromClipboard } from "@/shared/lib/clipboard";
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
  const pendingDa1Ref = useRef(false);
  const lastOutputRef = useRef<string>("");
  const [termState, setTermState] = useState<XTerm | null>(null);
  const { fontSize, fontFamily, fontId, scrollback, aiSuggestions } = useTerminalStore();
  const terminalFontFamily = fontId || fontFamily;
  const { themeId, resolvedMode } = useTheme();

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
    let da1Handler: { dispose: () => void } | null = null;

    async function setup() {
      if (!containerRef.current) return;

      // Don't block shell spawn on font loading; cap the initial wait at 300ms.
      const fontsReady = document.fonts?.ready;
      if (fontsReady) {
        await Promise.race([fontsReady, new Promise<void>((resolve) => setTimeout(resolve, 300))]);
      }
      if (disposed) return;

      const t = new XTerm({
        fontSize,
        fontFamily: `${terminalFontFamily}, Consolas, Courier New, monospace`,
        cursorBlink: true,
        cursorStyle: "block",
        convertEol: true,
        scrollback,
        theme: getXtermTheme(),
      });
      const fit = new FitAddon();
      fitRef.current = fit;
      t.loadAddon(fit);
      t.loadAddon(
        new WebLinksAddon((event: MouseEvent, uri: string) => {
          event.preventDefault();
          void invoke("open_external_url", { url: uri });
        }),
      );
      t.open(containerRef.current);
      termRef.current = t;
      setTermState(t);

      da1Handler = t.parser.registerCsiHandler({ final: "c" }, (params) => {
        // DA1: CSI c or CSI 0 c
        if (params.length > 0 && params[0] !== 0) return false;

        const ptyId = ptyIdRef.current;
        if (ptyId) {
          safePtyInvoke(invoke("write_pty", { id: ptyId, data: "\x1b[?1;2c" }));
        } else {
          pendingDa1Ref.current = true;
        }
        return true;
      });

      const unlisten = await listen<PtyOutputEvent>("pty_output", (event) => {
        if (event.payload.id === ptyIdRef.current) {
          t.write(event.payload.data);
          lastOutputRef.current = (lastOutputRef.current + event.payload.data).slice(-1000);
        }
      });
      unlistenFn = unlisten;
      if (disposed || !containerRef.current) return;

      fit.fit();

      // Refit once fonts have actually loaded so cell measurements are correct.
      void fontsReady?.then(() => {
        if (disposed || !termRef.current || !fitRef.current) return;
        fitRef.current.fit();
        const { cols, rows } = termRef.current;
        if (ptyIdRef.current && cols > 0 && rows > 0) {
          safePtyInvoke(invoke("resize_pty", { id: ptyIdRef.current, rows, cols }));
        }
      });

      if (!session.ptyId) {
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
              cwd: session.cwd ?? null,
              cols: Math.max(cols, 10),
              rows: Math.max(rows, 2),
            });
          }
          if (disposed) return;
          ptyIdRef.current = ptyId;
          useTerminalStore.getState().attachPty(session.id, ptyId);

          if (pendingDa1Ref.current) {
            pendingDa1Ref.current = false;
            safePtyInvoke(invoke("write_pty", { id: ptyId, data: "\x1b[?1;2c" }));
          }
        } catch (err) {
          t.writeln(`\r\nFailed to start shell: ${String(err)}`);
          return;
        }
      }

      const { cols: fitCols, rows: fitRows } = t;
      if (fitCols > 0 && fitRows > 0 && ptyIdRef.current) {
        safePtyInvoke(
          invoke("resize_pty", {
            id: ptyIdRef.current,
            rows: fitRows,
            cols: fitCols,
          }),
        );
      }

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          resizeTimer = null;
          fit.fit();
          const { cols: newCols, rows: newRows } = t;
          if (newCols > 0 && newRows > 0 && ptyIdRef.current) {
            safePtyInvoke(
              invoke("resize_pty", {
                id: ptyIdRef.current,
                rows: newRows,
                cols: newCols,
              }),
            );
          }
        }, 120);
      });
      if (disposed || !containerRef.current) return;
      resizeObserver.observe(containerRef.current);

      requestAnimationFrame(() => {
        fit.fit();
        const { cols: rafCols, rows: rafRows } = t;
        if (rafCols > 0 && rafRows > 0 && ptyIdRef.current) {
          safePtyInvoke(
            invoke("resize_pty", { id: ptyIdRef.current, rows: rafRows, cols: rafCols }),
          );
        }
      });
      setTimeout(() => {
        fit.fit();
        const { cols: toCols, rows: toRows } = t;
        if (toCols > 0 && toRows > 0 && ptyIdRef.current) {
          safePtyInvoke(invoke("resize_pty", { id: ptyIdRef.current, rows: toRows, cols: toCols }));
        }
      }, 100);
    }

    void setup();

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      unlistenFn?.();
      resizeObserver?.disconnect();
      da1Handler?.dispose();
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
      ptyIdRef.current = null;
      pendingDa1Ref.current = false;
    };
  }, [
    session.command,
    session.shell,
    session.cwd,
    fontSize,
    terminalFontFamily,
    scrollback,
    session.id,
  ]);

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

  useEffect(() => {
    if (!termState) return;

    const disposable = termState.onSelectionChange(() => {
      dispatchTerminalSelection(termState.getSelection());
    });

    return () => {
      disposable.dispose();
    };
  }, [termState]);

  useEffect(() => {
    if (!termState) return;

    const handleData = suggestions.handleData;
    const disposable = termState.onData((data) => {
      if (data === "\t") return;

      if (!handleData(data) && ptyIdRef.current) {
        safePtyInvoke(invoke("write_pty", { id: ptyIdRef.current, data }));
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
        safePtyInvoke(invoke("write_pty", { id: ptyIdRef.current, data: "\t" }));
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [suggestions.visible, suggestions.accept]);

  useEffect(() => {
    if (!termState) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;

      const container = containerRef.current;
      if (!container) return;

      const activeElement = document.activeElement;
      if (!activeElement || !container.contains(activeElement)) return;

      const key = event.key.toLowerCase();
      if (key === "c") {
        const term = termRef.current;
        const selection = term?.getSelection();
        if (selection) {
          void copyToClipboard(selection);
          term?.clearSelection();
          event.preventDefault();
          event.stopPropagation();
        }
        // If nothing is selected, let xterm send Ctrl+C (SIGINT) to the PTY.
      } else if (key === "v") {
        void readFromClipboard().then((text) => {
          if (text && ptyIdRef.current) {
            safePtyInvoke(invoke("write_pty", { id: ptyIdRef.current, data: text }));
          }
        });
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [termState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;

      const container = containerRef.current;
      if (!container) return;

      const activeElement = document.activeElement;
      if (!activeElement || !container.contains(activeElement)) return;

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        const next = fontSize + 1;
        useTerminalStore.getState().setFontSize(next);
        useSettingsStore.getState().setTerminalSettings({ fontSize: next });
      } else if (event.key === "-") {
        event.preventDefault();
        const next = Math.max(8, fontSize - 1);
        useTerminalStore.getState().setFontSize(next);
        useSettingsStore.getState().setTerminalSettings({ fontSize: next });
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [fontSize]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const handleClear = () => {
      if (isActive) term.clear();
    };

    window.addEventListener("pragma:terminal:clear", handleClear);
    return () => window.removeEventListener("pragma:terminal:clear", handleClear);
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
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
