import { Button } from "@/shared/components/ui/button";
import { type GitStatusEntry } from "@/shared/stores/git";
import { cn } from "@/shared/lib/utils";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/components/ui/context-menu";
import { ArrowCounterClockwise, GitDiff, Minus, Plus, Trash } from "@phosphor-icons/react";
import { getFileIconPath } from "@/shared/lib/file-icons";
import { basename, dirname } from "./utils";
import { STATE_INFO, fileState, stageState, type StageState } from "./fileState";

function RowAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className="text-fg-subtle"
    >
      {children}
    </Button>
  );
}

/// A small lit cell in front of the file: full when staged, half when only part is staged.
function StageMark({ state }: { state: StageState }) {
  if (state === "none") return <span aria-hidden="true" className="size-1.5 shrink-0" />;
  const label = state === "staged" ? "Staged" : "Partly staged";
  return (
    <span
      role="img"
      title={label}
      aria-label={label}
      className={cn(
        "size-1.5 shrink-0 rounded-[1px]",
        state === "staged"
          ? "bg-primary shadow-[0_0_5px_var(--color-primary)]"
          : "bg-[linear-gradient(90deg,var(--color-primary)_50%,transparent_50%)] ring-1 ring-primary/60",
      )}
    />
  );
}

/** Where a moved file came from, shortened to the part that changed. */
function movedFrom(entry: GitStatusEntry): string | null {
  if (!entry.original_path) return null;
  const fromDir = dirname(entry.original_path);
  const toDir = dirname(entry.path);
  if (fromDir !== toDir) return `${fromDir || "."}/ → ${toDir || "."}/`;
  return `${basename(entry.original_path)} →`;
}

export function FileRow({
  entry,
  isSelected,
  actionBusy,
  onStage,
  onUnstage,
  onSelect,
  onOpenDiff,
  onDiscard,
}: {
  entry: GitStatusEntry;
  isSelected: boolean;
  actionBusy: string | null;
  onStage: (entry: GitStatusEntry) => void;
  onUnstage: (entry: GitStatusEntry) => void;
  onSelect: (entry: GitStatusEntry) => void;
  onOpenDiff: (entry: GitStatusEntry, staged: boolean) => void;
  onDiscard?: (entry: GitStatusEntry) => void;
}) {
  const fileName = basename(entry.path);
  const dir = dirname(entry.path);
  const staged = stageState(entry);
  const moved = movedFrom(entry);
  const state = fileState(entry);
  const deleted = state === "D";
  const openDiff = () => onOpenDiff(entry, staged === "staged");

  const row = (
    <div
      className={cn(
        "group relative mx-1.5 flex h-8 items-center gap-2 rounded-[5px] pr-2 pl-2 transition-colors duration-100",
        isSelected
          ? "bg-primary/10 text-fg-default ring-1 ring-primary/40 ring-inset"
          : "hover:bg-bg-hover",
      )}
      onClick={() => onSelect(entry)}
      onDoubleClick={openDiff}
    >
      <StageMark state={staged} />
      <img src={getFileIconPath(fileName)} alt="" className="size-3.5 shrink-0" />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5 leading-none">
        <span
          className={cn(
            "truncate text-ui-sm leading-tight",
            deleted ? "text-fg-subtle line-through" : "text-fg-default",
          )}
        >
          {fileName}
        </span>
        {moved ? (
          <span className="truncate font-mono text-[11px] text-fg-subtle">{moved}</span>
        ) : (
          dir && <span className="truncate font-mono text-[11px] text-fg-subtle">{dir}</span>
        )}
      </div>
      <div className="hidden shrink-0 items-center group-hover:flex">
        <RowAction label="Open diff" onClick={openDiff}>
          <GitDiff size={13} />
        </RowAction>
        {onDiscard && entry.is_unstaged && (
          <RowAction label="Discard changes" onClick={() => onDiscard(entry)}>
            <ArrowCounterClockwise size={13} />
          </RowAction>
        )}
        {staged !== "none" && (
          <RowAction
            label={`Unstage ${fileName}`}
            disabled={actionBusy !== null}
            onClick={() => onUnstage(entry)}
          >
            <Minus size={13} />
          </RowAction>
        )}
        {staged !== "staged" && (
          <RowAction
            label={`Stage ${fileName}`}
            disabled={actionBusy !== null}
            onClick={() => onStage(entry)}
          >
            <Plus size={13} />
          </RowAction>
        )}
      </div>
      <span
        title={STATE_INFO[state].title}
        aria-label={STATE_INFO[state].title}
        className={cn(
          "inline-flex size-4.5 shrink-0 items-center justify-center rounded-[3px] bg-current/15 font-mono text-[10px] font-bold",
          STATE_INFO[state].color,
        )}
      >
        {state}
      </span>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>{row}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {staged !== "staged" && (
          <ContextMenuItem onClick={() => onStage(entry)}>Stage</ContextMenuItem>
        )}
        {staged !== "none" && (
          <ContextMenuItem onClick={() => onUnstage(entry)}>Unstage</ContextMenuItem>
        )}
        <ContextMenuItem onClick={openDiff}>
          <GitDiff size={14} />
          Open Diff
        </ContextMenuItem>
        {onDiscard && entry.is_unstaged && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onDiscard(entry)} variant="destructive">
              <Trash size={14} />
              Discard Changes
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
