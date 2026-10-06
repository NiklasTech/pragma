import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { unlistenQuietly } from "@/shared/lib/unlisten";
import {
  useTerminalStore,
  type TerminalSession as TerminalSessionType,
} from "@/shared/stores/terminal";
import { useFileExplorerStore } from "@/shared/stores/fileExplorer";
import { useSettingsStore } from "@/shared/stores/settings";
import { getXtermTheme } from "@/shared/lib/theme/xterm-theme";
import { fixWebKitDeadKeys } from "@/shared/lib/terminal-dead-keys";
import { safePtyInvoke } from "../safePtyInvoke";
import { registerTerminalOutput } from "../terminalOutput";
import { loadRenderAddons, passFindShortcut } from "../terminalAddons";
import { terminalEnvFor } from "../terminalEnv";
import { takeTerminalScrollback } from "../terminalScrollback";

interface PtyOutputEvent {
  id: string;
  data: string;
}

interface TerminalSetupOptions {
  session: TerminalSessionType;
  containerRef: RefObject<HTMLDivElement | null>;
  termRef: RefObject<XTerm | null>;
  fitRef: RefObject<FitAddon | null>;
  ptyIdRef: RefObject<string | null>;
  pendingDa1Ref: RefObject<boolean>;
  lastOutputRef: RefObject<string>;
  lastActivityMarkRef: RefObject<number>;
  setTermState: Dispatch<SetStateAction<XTerm | null>>;
  setShowScrollDown: Dispatch<SetStateAction<boolean>>;
  fontSize: number;
  terminalFontFamily: string;
  scrollback: number;
  lineHeight: number;
}

// Creates the xterm instance, spawns or attaches the PTY and keeps both sized together.
export function useTerminalSetup({
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
}: TerminalSetupOptions) {
  useEffect(() => {
    let disposed = false;
    let unlistenFn: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let da1Handler: { dispose: () => void } | null = null;
    let scrollHandler: { dispose: () => void } | null = null;
    let removeDeadKeyFix: (() => void) | null = null;
    let unregisterOutput: (() => void) | null = null;

    async function setup() {
      if (!containerRef.current) return;

      // Don't block shell spawn on font loading; cap the initial wait at 300ms.
      const fontsReady = document.fonts?.ready;
      if (fontsReady) {
        await Promise.race([fontsReady, new Promise<void>((resolve) => setTimeout(resolve, 300))]);
      }
      if (disposed) return;

      const { cursorStyle, cursorBlink } = useSettingsStore.getState().terminal;
      const t = new XTerm({
        fontSize,
        fontFamily: `${terminalFontFamily}, Consolas, Courier New, monospace`,
        lineHeight,
        cursorBlink,
        cursorStyle,
        convertEol: true,
        scrollback,
        theme: getXtermTheme(),
        allowProposedApi: true,
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
      loadRenderAddons(t);
      passFindShortcut(t);
      removeDeadKeyFix = fixWebKitDeadKeys(t, containerRef.current);
      termRef.current = t;
      unregisterOutput = registerTerminalOutput(session.id, t);
      setTermState(t);
      ptyIdRef.current = session.ptyId ?? null;
      const restored = session.ptyId ? null : takeTerminalScrollback(session.id);
      if (restored) t.write(`${restored}\n`);

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

      scrollHandler = t.onScroll(() => {
        setShowScrollDown(t.buffer.active.viewportY < t.buffer.active.baseY);
      });

      const writeOutput = (data: string) => {
        t.write(data);
        lastOutputRef.current = (lastOutputRef.current + data).slice(-1000);
        const now = Date.now();
        if (now - lastActivityMarkRef.current > 500) {
          lastActivityMarkRef.current = now;
          useTerminalStore.getState().markActivity(session.id);
        }
      };

      // The shell can print its prompt before create_pty resolves, so hold output until the id is known.
      let earlyOutput: PtyOutputEvent[] | null = session.ptyId ? null : [];
      const unlisten = await listen<PtyOutputEvent>("pty_output", (event) => {
        if (event.payload.id === ptyIdRef.current) {
          writeOutput(event.payload.data);
        } else if (earlyOutput && earlyOutput.length < 500) {
          earlyOutput.push(event.payload);
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
              env: terminalEnvFor(useFileExplorerStore.getState().rootPath),
            });
          }
          if (disposed) {
            safePtyInvoke(invoke("kill_pty", { id: ptyId }));
            return;
          }
          ptyIdRef.current = ptyId;
          for (const event of earlyOutput ?? []) {
            if (event.id === ptyId) writeOutput(event.data);
          }
          earlyOutput = null;
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
      void unlistenQuietly(unlistenFn);
      resizeObserver?.disconnect();
      da1Handler?.dispose();
      scrollHandler?.dispose();
      removeDeadKeyFix?.();
      unregisterOutput?.();
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
    lineHeight,
    session.id,
  ]);
}
