import { type GitStatusEntry } from "@/shared/stores/git";
import { cn } from "@/shared/lib/utils";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/components/ui/context-menu";
import { GitDiff, Trash } from "@phosphor-icons/react";
import { StatusIcon } from "./StatusIcon";
import { basename, dirname, statusAccent } from "./utils";

export function FileRow({
  entry,
  isSelected,
  actionBusy,
  mode,
  onToggle,
  onSelect,
  onOpenDiff,
  onDiscard,
}: {
  entry: GitStatusEntry;
  isSelected: boolean;
  actionBusy: string | null;
  mode: "staged" | "unstaged";
  onToggle: (entry: GitStatusEntry) => void;
  onSelect: (entry: GitStatusEntry) => void;
  onOpenDiff: (entry: GitStatusEntry) => void;
  onDiscard?: (entry: GitStatusEntry) => void;
}) {
  const fileName = basename(entry.path);
  const dir = dirname(entry.path);
  const checkState =
    mode === "staged" ? (entry.is_unstaged ? "indeterminate" : "checked") : "unchecked";

  const row = (
    <div
      className={cn(
        "group relative flex h-[30px] items-center gap-2 rounded-md pl-2 pr-2 transition-all duration-100",
        isSelected ? "bg-bg-active text-fg-default" : "hover:bg-bg-hover",
      )}
      onClick={() => onSelect(entry)}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-full transition-opacity",
          statusAccent(entry.status_code),
          isSelected ? "opacity-100" : "opacity-55 group-hover:opacity-95",
        )}
      />
      <Checkbox
        checked={checkState === "checked"}
        disabled={actionBusy !== null}
        onCheckedChange={() => onToggle(entry)}
        className="size-3.5"
        data-indeterminate={checkState === "indeterminate" || undefined}
        onClick={(e) => e.stopPropagation()}
      />
      <StatusIcon status={entry.status} />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none">
        <span className="truncate text-ui-sm leading-tight">{fileName}</span>
        {dir && <span className="truncate text-ui-xs text-fg-muted/70">{dir}</span>}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDiff(entry);
        }}
        className="shrink-0 rounded p-0.5 text-fg-muted opacity-0 transition-opacity hover:text-fg-default group-hover:opacity-100"
        title="Open diff in editor"
      >
        <GitDiff size={13} />
      </button>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>{row}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onToggle(entry)}>
          {mode === "staged" ? "Unstage" : "Stage"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onOpenDiff(entry)}>
          <GitDiff size={14} className="mr-2" />
          Open Diff
        </ContextMenuItem>
        <ContextMenuSeparator />
        {onDiscard && mode === "unstaged" && (
          <ContextMenuItem
            onClick={() => onDiscard(entry)}
            className="text-status-error focus:text-status-error"
          >
            <Trash size={14} className="mr-2" />
            Discard Changes
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
