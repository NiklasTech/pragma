import { cn } from "@/shared/lib/utils";
import { GraphRail } from "../GraphRail";
import type { GraphRow } from "../lib/gitGraphLayout";
import { COMPACT_ROW_HEIGHT } from "./constants";
import { authorInitials, authorTint, relativeDate } from "./format";
import type { GitLogEntry } from "./types";

export function CompactCommitRow({
  commit,
  active,
  isHead,
  graphRow,
  maxLaneCount,
  onClick,
}: {
  commit: GitLogEntry;
  active: boolean;
  isHead: boolean;
  graphRow: GraphRow | null;
  maxLaneCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-full w-full cursor-pointer items-stretch gap-1 rounded-md pr-2 text-left transition-colors",
        active ? "bg-accent-subtle" : "hover:bg-bg-hover",
      )}
    >
      <div className="flex shrink-0 items-center">
        {graphRow ? (
          <GraphRail
            row={graphRow}
            rowHeight={COMPACT_ROW_HEIGHT}
            maxLaneCount={maxLaneCount}
            active={active}
          />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span
          className={cn(
            "truncate text-ui-sm leading-tight",
            active ? "font-medium text-fg-default" : "text-fg-default/90",
          )}
          title={commit.subject}
        >
          {commit.subject || <span className="text-fg-muted">(no subject)</span>}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-ui-2xs text-fg-subtle">
          <span
            className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full font-mono text-[8px] font-bold text-fg-inverse uppercase"
            style={{ backgroundColor: authorTint(commit.author_email || commit.author) }}
            title={commit.author}
          >
            {authorInitials(commit.author)}
          </span>
          <span className="min-w-0 truncate">{commit.author || "Unknown"}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0 tabular-nums">{relativeDate(commit.timestamp_secs)}</span>
          {isHead && (
            <span className="shrink-0 rounded-full bg-accent-subtle px-1.5 font-medium text-primary">
              HEAD
            </span>
          )}
          <span className="ml-auto shrink-0 font-mono">{commit.short_sha.slice(0, 7)}</span>
        </span>
      </div>
    </button>
  );
}
