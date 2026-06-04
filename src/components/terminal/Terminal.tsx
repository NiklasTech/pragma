import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { useTerminalStore } from "@/stores/terminal";

interface PtyOutputEvent {
  id: string;
  data: string;
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

function isCopyShortcut(e: KeyboardEvent): boolean {
  if (IS_MAC) return e.metaKey && !e.ctrlKey && !e.altKey && e.code === "KeyC";
  return e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyC";
}

function isPasteShortcut(e: KeyboardEvent): boolean {
  if (IS_MAC) return e.metaKey && !e.ctrlKey && !e.altKey && e.code === "KeyV";
  return e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyV";
}

function isTerminalCopy(e: KeyboardEvent): boolean {
  return !IS_MAC && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyC";
}

function isTerminalPaste(e: KeyboardEvent): boolean {
  return !IS_MAC && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyV";
}

function execCopy(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let success = false;
  try {
    success = document.execCommand("copy");
  } catch {
    success = false;
  }
  document.body.removeChild(textarea);
  return success;
}

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const { defaultShell, fontSize, fontFamily, scrollback } = useTerminalStore();

  const focusTerminal = useCallback(() => {
    termRef.current?.focus();
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlistenFn: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let keyHandler: ((e: KeyboardEvent) => void) | null = null;

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
      t.loadAddon(fit);
      t.open(containerRef.current);
      t.focus();
      termRef.current = t;

      keyHandler = (event: KeyboardEvent) => {
        const active = document.activeElement;
        const inTerminal =
          active !== null &&
          active !== document.body &&
          containerRef.current !== null &&
          containerRef.current.contains(active);

        if (!inTerminal) return;

        const copyShortcut = isCopyShortcut(event) || isTerminalCopy(event);
        const pasteShortcut = isPasteShortcut(event) || isTerminalPaste(event);

        if (copyShortcut && t.hasSelection()) {
          event.preventDefault();
          event.stopPropagation();
          const sel = t.getSelection();
          if (sel) execCopy(sel);
          t.clearSelection();
          return;
        }

        if (pasteShortcut) {
          event.preventDefault();
          event.stopPropagation();
          void navigator.clipboard
            .readText()
            .then((text) => {
              if (text) t.paste(text);
            })
            .catch(() => {});
          return;
        }
      };

      window.addEventListener("keydown", keyHandler, true);

      const unlisten = await listen<PtyOutputEvent>("pty_output", (event) => {
        if (event.payload.id === ptyIdRef.current) {
          t.write(event.payload.data);
        }
      });
      unlistenFn = unlisten;

      fit.fit();
      const { cols, rows } = t;

      const shellArg = defaultShell.trim().length > 0 ? defaultShell : undefined;

      try {
        const ptyId = await invoke<string>("create_pty", {
          shell: shellArg,
          cols: Math.max(cols, 10),
          rows: Math.max(rows, 2),
        });
        if (disposed) return;
        ptyIdRef.current = ptyId;
      } catch (err) {
        t.writeln(`\r\nFailed to start shell: ${String(err)}`);
        return;
      }

      t.onData((data) => {
        if (ptyIdRef.current) {
          void invoke("write_pty", { id: ptyIdRef.current, data });
        }
      });

      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          resizeTimer = null;
          fit.fit();
          const { cols, rows } = t;
          if (cols > 0 && rows > 0 && ptyIdRef.current) {
            void invoke("resize_pty", {
              id: ptyIdRef.current,
              rows,
              cols,
            });
          }
        }, 120);
      });
      resizeObserver.observe(containerRef.current);

      requestAnimationFrame(() => {
        fit.fit();
        const { cols, rows } = t;
        if (cols > 0 && rows > 0 && ptyIdRef.current) {
          void invoke("resize_pty", { id: ptyIdRef.current, rows, cols });
        }
      });
      setTimeout(() => {
        fit.fit();
        const { cols, rows } = t;
        if (cols > 0 && rows > 0 && ptyIdRef.current) {
          void invoke("resize_pty", { id: ptyIdRef.current, rows, cols });
        }
      }, 100);
    }

    void setup();

    return () => {
      disposed = true;
      if (resizeTimer) clearTimeout(resizeTimer);
      if (keyHandler) window.removeEventListener("keydown", keyHandler, true);
      unlistenFn?.();
      resizeObserver?.disconnect();
      termRef.current?.dispose();
      termRef.current = null;
      ptyIdRef.current = null;
    };
  }, [defaultShell, fontSize, fontFamily, scrollback]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative overflow-hidden"
      onClick={focusTerminal}
    />
  );
}
