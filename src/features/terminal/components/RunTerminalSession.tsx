import { useEffect, useRef, useState } from "react";
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
import { useTheme } from "@/theme";
import { getXtermTheme } from "@/shared/lib/theme/xterm-theme";
import { dispatchTerminalSelection } from "@/shared/lib/terminal-events";
import { copyToClipboard } from "@/shared/lib/clipboard";

interface RunOutputEvent {
  process_id: string;
  data: string;
}

interface RunStatusEvent {
  process_id: string;
  status: "running" | "failed" | "stopped";
  exit_code: number | null;
}

interface RunTerminalSessionProps {
  session: TerminalSessionType;
  isActive: boolean;
}

export function RunTerminalSession({ session, isActive }: RunTerminalSessionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [termState, setTermState] = useState<XTerm | null>(null);
  const { fontSize, fontFamily, fontId, scrollback } = useTerminalStore();
  const terminalFontFamily = fontId || fontFamily;
  const { themeId, resolvedMode } = useTheme();

  useEffect(() => {
    let disposed = false;
    let unlistenOutput: (() => void) | null = null;
    let unlistenStatus: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    async function setup() {
      if (!containerRef.current) return;

      const fontsReady = document.fonts?.ready;
      if (fontsReady) {
        await Promise.race([fontsReady, new Promise<void>((resolve) => setTimeout(resolve, 300))]);
      }
      if (disposed) return;

      const t = new XTerm({
        fontSize,
        fontFamily: `${terminalFontFamily}, Consolas, Courier New, monospace`,
        cursorBlink: false,
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

      const processId = session.processId;
      if (!processId) return;

      unlistenOutput = await listen<RunOutputEvent>("run_output", (event) => {
        if (event.payload.process_id === processId) {
          t.write(event.payload.data);
        }
      });

      unlistenStatus = await listen<RunStatusEvent>("run_status_changed", (event) => {
        if (event.payload.process_id === processId) {
          const { status, exit_code } = event.payload;
          const codeText = exit_code !== null ? ` (exit code ${exit_code})` : "";
          t.writeln(`\r\n[process ${status}${codeText}]`);
        }
      });

      if (disposed) return;
      fit.fit();

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          resizeTimer = null;
          fit.fit();
        }, 120);
      });
      resizeObserver.observe(containerRef.current);

      requestAnimationFrame(() => fit.fit());
      setTimeout(() => fit.fit(), 100);
    }

    void setup();

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      unlistenOutput?.();
      unlistenStatus?.();
      resizeObserver?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [session.processId, fontSize, terminalFontFamily, scrollback]);

  useEffect(() => {
    if (!termRef.current) return;
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
    }
  }, [isActive]);

  useEffect(() => {
    if (!termState) return;
    const disposable = termState.onSelectionChange(() => {
      dispatchTerminalSelection(termState.getSelection());
    });
    return () => disposable.dispose();
  }, [termState]);

  useEffect(() => {
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
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [termState]);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{ display: isActive ? "block" : "none" }}
    />
  );
}
