import { useCallback } from "react";
import { Terminal as TerminalIcon } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { useLayoutStore } from "../store";
import { FloatingWindow } from "./FloatingWindow";
import { Terminal } from "@/features/terminal/components";
import { createFloating, createPanel } from "../tree/operations";

export function TerminalFloatingHost() {
  const { terminal, setTerminalMode, setTerminalFloating } = useLayoutStore();

  const handleMove = useCallback(
    (x: number, y: number) => {
      setTerminalFloating({ x, y });
    },
    [setTerminalFloating],
  );

  const handleResize = useCallback(
    (width: number, height: number) => {
      setTerminalFloating({ width, height });
    },
    [setTerminalFloating],
  );

  const handleExternalize = useCallback(async () => {
    const panel = createPanel("terminal");
    const node = createFloating(panel, {
      x: Math.round(terminal.floating.x),
      y: Math.round(terminal.floating.y),
      width: Math.round(terminal.floating.width),
      height: Math.round(terminal.floating.height),
    });

    try {
      const label = await invoke<string>("create_external_window", {
        nodeId: node.id,
        title: "Terminal",
        bounds: {
          x: Math.round(node.x),
          y: Math.round(node.y),
          width: Math.round(node.width),
          height: Math.round(node.height),
        },
      });
      useLayoutStore.setState((s) => ({
        floating: [...s.floating, { ...node, external: label }],
      }));
      setTerminalMode("hidden");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to create external terminal window:", err);
    }
  }, [terminal.floating, setTerminalMode]);

  if (terminal.mode !== "floating-tab") return null;

  return (
    <FloatingWindow
      x={terminal.floating.x}
      y={terminal.floating.y}
      width={terminal.floating.width}
      height={terminal.floating.height}
      minWidth={400}
      minHeight={240}
      title={
        <>
          <TerminalIcon size={16} className="text-primary shrink-0" />
          <span className="text-ui-sm font-semibold truncate">Terminal</span>
        </>
      }
      onMove={handleMove}
      onResize={handleResize}
      onClose={() => setTerminalMode("hidden")}
      onExternalize={() => void handleExternalize()}
    >
      <Terminal />
    </FloatingWindow>
  );
}
