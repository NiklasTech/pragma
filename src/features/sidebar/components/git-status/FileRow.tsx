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
import { ArrowCounterClockwise, GitDiff, Trash } from "@phosphor-icons/react";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { basename, dirname } from "./utils";

function statusLetter(code: string): { text: string; className: string } {
  switch (code) {
    case "A":
      return { text: "A", className: "text-git-added" };
    case "D":
      return { text: "D", className: "text-git-deleted" };
    case "R":
      return { text: "R", className: "text-git-modified" };
    case "?":
      return { text: "U", className: "text-git-untracked" };
    default:
      return { text: code === "M" ? "M" : code.slice(0, 1) || "M", className: "text-git-modified" };
  }
}

function RowAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className="flex size-6 items-center justify-center rounded text-fg-subtle transition-colors hover:bg-bg-hover hover:text-fg-default"
    >
      {children}
    </button>
  );
}

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

  const letter = statusLetter(entry.status_code);

  const row = (
    <div
      className={cn(
        "group relative mx-1.5 flex h-8 items-center gap-2 rounded-md pr-1 pl-1.5 transition-colors duration-100",
        isSelected ? "bg-accent-subtle text-fg-default" : "hover:bg-bg-hover",
      )}
      onClick={() => onSelect(entry)}
    >
      <Checkbox
        checked={checkState === "checked"}
        disabled={actionBusy !== null}
        onCheckedChange={() => onToggle(entry)}
        className="size-3.5"
        data-indeterminate={checkState === "indeterminate" || undefined}
        onClick={(e) => e.stopPropagation()}
        aria-label={mode === "staged" ? `Unstage ${fileName}` : `Stage ${fileName}`}
      />
      <img src={getFileIconPath(fileName)} alt="" className="size-3.5 shrink-0" />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none">
        <span
          className={cn(
            "truncate text-ui-sm leading-tight",
            entry.status_code === "D" ? "text-fg-muted line-through" : "text-fg-default",
          )}
        >
          {fileName}
        </span>
        {dir && <span className="truncate text-ui-2xs text-fg-subtle">{dir}</span>}
      </div>
      <div className="hidden shrink-0 items-center group-hover:flex">
        <RowAction label="Open diff" onClick={() => onOpenDiff(entry)}>
          <GitDiff size={13} />
        </RowAction>
        {onDiscard && mode === "unstaged" && (
          <RowAction label="Discard changes" onClick={() => onDiscard(entry)}>
            <ArrowCounterClockwise size={13} />
          </RowAction>
        )}
      </div>
      <span
        className={cn(
          "w-3 shrink-0 text-center font-mono text-ui-2xs font-semibold",
          letter.className,
        )}
        title={entry.status}
      >
        {letter.text}
      </span>
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
          <GitDiff size={14} />
          Open Diff
        </ContextMenuItem>
        <ContextMenuSeparator />
        {onDiscard && mode === "unstaged" && (
          <ContextMenuItem onClick={() => onDiscard(entry)} variant="destructive">
            <Trash size={14} />
            Discard Changes
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
