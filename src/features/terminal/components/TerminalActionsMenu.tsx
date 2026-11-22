import { DotsThree } from "@phosphor-icons/react";

import { menuShortcut } from "@/shared/components/ui/action-menu";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  dispatchTerminalClear,
  dispatchTerminalCopyOutput,
  dispatchTerminalFind,
} from "@/shared/lib/terminal-events";

interface TerminalActionsMenuProps {
  sessionId: string | null;
  onSplit?: () => void;
  onClosePanel?: () => void;
}

/// What a terminal panel can do, named and with its keys, behind one button instead of a row of icons.
export function TerminalActionsMenu({
  sessionId,
  onSplit,
  onClosePanel,
}: TerminalActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Terminal actions"
            title="Terminal actions"
            className="text-fg-muted"
          >
            <DotsThree size={15} weight="bold" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-[210px]">
        <DropdownMenuItem
          disabled={!sessionId}
          onClick={() => sessionId && dispatchTerminalFind(sessionId)}
        >
          Find
          <DropdownMenuShortcut>{menuShortcut(["mod"], "F")}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!sessionId}
          onClick={() => sessionId && dispatchTerminalCopyOutput(sessionId)}
        >
          Copy all output
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!sessionId}
          onClick={() => sessionId && dispatchTerminalClear(sessionId)}
        >
          Clear
          <DropdownMenuShortcut>{menuShortcut(["mod"], "K")}</DropdownMenuShortcut>
        </DropdownMenuItem>
        {(onSplit || onClosePanel) && <DropdownMenuSeparator />}
        {onSplit && <DropdownMenuItem onClick={onSplit}>Split right</DropdownMenuItem>}
        {onClosePanel && (
          <DropdownMenuItem onClick={onClosePanel} className="text-status-error">
            Close panel
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
