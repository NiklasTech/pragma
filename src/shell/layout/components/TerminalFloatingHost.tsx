import { useCallback } from "react";
import { Terminal as TerminalIcon } from "@phosphor-icons/react";
import { useLayoutStore } from "../store";
import { FloatingWindow } from "./FloatingWindow";
import { Terminal } from "@/features/terminal/components";

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
    >
      <Terminal />
    </FloatingWindow>
  );
}
