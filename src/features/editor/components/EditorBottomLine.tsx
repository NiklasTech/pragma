import { CaretDown, CaretUp, Check, TerminalWindow, X } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useEditorStore } from "@/shared/stores/editor";
import { useLastCommandStore } from "@/features/terminal/shellIntegration/lastCommand";
import { useLayoutStore } from "@/shell/layout/store";

import { EditorStatusChip } from "./EditorStatusChip";

/// The one line under the code: the terminal, folded to its last command, and the open file's details.
export function EditorBottomLine() {
  const terminalOpen = useLayoutStore((state) => state.terminal.mode !== "hidden");
  const toggleTerminal = useLayoutStore((state) => state.toggleTerminal);
  const last = useLastCommandStore((state) => state.last);
  const panelId = useEditorStore((state) => state.lastFocusedPanelId);
  const failed = last !== null && last.exitCode !== 0;

  return (
    <div className="flex h-8.5 shrink-0 items-center gap-2.5 border-t border-border-subtle px-2">
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={terminalOpen}
        onClick={toggleTerminal}
        title={terminalOpen ? "Hide the terminal" : "Show the terminal"}
        className="min-w-0 gap-2 px-2 font-normal text-fg-muted"
      >
        <TerminalWindow size={14} aria-hidden="true" />
        <span>Terminal</span>
        {last && (
          <>
            <span className="min-w-0 truncate font-mono text-ui-2xs text-fg-subtle">
              {last.command}
            </span>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 text-ui-2xs",
                failed ? "text-status-error" : "text-status-success",
              )}
            >
              {failed ? (
                <X size={11} weight="bold" aria-hidden="true" />
              ) : (
                <Check size={11} weight="bold" aria-hidden="true" />
              )}
              {failed ? `exit ${last.exitCode ?? "?"}` : "ok"}
            </span>
          </>
        )}
        {terminalOpen ? (
          <CaretDown size={11} className="text-fg-subtle" aria-hidden="true" />
        ) : (
          <CaretUp size={11} className="text-fg-subtle" aria-hidden="true" />
        )}
      </Button>
      {panelId && <EditorStatusChip panelId={panelId} />}
    </div>
  );
}
