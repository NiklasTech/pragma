import { Kbd, KbdGroup } from "@/shared/components/ui/kbd";
import { useEffect, useRef } from "react";

export type PresenceState = "open" | "closed";

export type SelectionAskAiProps = {
  state: PresenceState;
  x: number;
  y: number;
  onAsk: () => void;
  onDismiss: () => void;
};

const MOD_KEY =
  typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")
    ? "Cmd"
    : "Ctrl";

const W = 120;
const OFFSET = 32;

export function SelectionAskAi({ state, x, y, onAsk, onDismiss }: SelectionAskAiProps) {
  const pos = useRef({ top: 0, left: 0 });
  const open = state === "open";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (open) {
    pos.current = {
      top: Math.max(8, y - OFFSET),
      left: Math.max(8, Math.min(x - W / 2, window.innerWidth - W - 8)),
    };
  }

  return (
    <div
      data-selection-ask-ai
      data-state={state}
      style={{ top: pos.current.top, left: pos.current.left, width: W }}
      className="fixed z-50 rounded-lg border border-border/60 bg-bg-elevated/95 p-1 shadow-lg backdrop-blur-md duration-150 ease-out animate-in fade-in zoom-in-95 data-[state=closed]:hidden"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAsk();
        }}
        className="flex h-7 w-full items-center justify-between gap-2 rounded-md px-2 text-xs transition-colors hover:bg-bg-hover"
      >
        <span>Ask Pragma</span>
        <KbdGroup>
          <Kbd className="h-4 min-w-4 px-1 text-ui-xs">{MOD_KEY}</Kbd>
          <Kbd className="h-4 min-w-4 px-1 text-ui-xs">L</Kbd>
        </KbdGroup>
      </button>
    </div>
  );
}
