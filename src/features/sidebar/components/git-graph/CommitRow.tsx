import { cn } from "@/shared/lib/utils";
import { GraphRail } from "../GraphRail";
import type { GraphRow } from "../lib/gitGraphLayout";
import { GRID_COLUMNS, ROW_HEIGHT } from "./constants";
import type { ColumnKey } from "./columns";
import { authorInitials, authorTint, compactDate } from "./format";
import type { GitLogEntry } from "./types";

export function CommitRow({
  commit,
  active,
  graphRow,
  maxLaneCount,
  collapsedCols,
  onClick,
}: {
  commit: GitLogEntry;
  active: boolean;
  graphRow: GraphRow | null;
  maxLaneCount: number;
  collapsedCols: Set<ColumnKey>;
  onClick: () => void;
}) {
  const date = compactDate(commit.timestamp_secs);
  const initials = authorInitials(commit.author);
  const totalStat = commit.insertions + commit.deletions;

  const shaCollapsed = collapsedCols.has("sha");
  const subjectCollapsed = collapsedCols.has("subject");
  const authorCollapsed = collapsedCols.has("author");
  const dateCollapsed = collapsedCols.has("date");
  const changesCollapsed = collapsedCols.has("changes");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative grid h-full w-full cursor-pointer items-center gap-5 rounded-md pr-3 text-left text-ui-base transition-colors",
        active ? "bg-bg-active" : "hover:bg-bg-hover",
      )}
      style={{
        gridTemplateColumns: GRID_COLUMNS,
      }}
    >
      {/* Rail */}
      <div className="flex items-center justify-start pl-1">
        {graphRow ? (
          <GraphRail
            row={graphRow}
            rowHeight={ROW_HEIGHT}
            maxLaneCount={maxLaneCount}
            active={active}
          />
        ) : null}
      </div>

      {/* SHA — collapsed: only first 4 chars */}
      <span
        className={cn(
          "pl-px font-mono text-ui-xs tabular-nums text-fg-muted",
          shaCollapsed && "text-ui-sm",
        )}
        title={commit.short_sha}
      >
        {shaCollapsed ? commit.short_sha.slice(0, 4) : commit.short_sha}
      </span>

      {/* Subject — collapsed */}
      <span
        className={cn(
          "min-w-0 truncate text-ui-base leading-tight",
          active ? "font-semibold text-fg-default" : "font-medium text-fg-default/95",
          subjectCollapsed && "text-ui-sm opacity-70",
        )}
        title={commit.subject}
      >
        {commit.subject || <span className="text-fg-muted">(no subject)</span>}
      </span>

      {/* Author — collapsed: only avatar */}
      <span
        className={cn(
          "mr-2 inline-flex h-[18px] max-w-full min-w-0 items-center gap-1.5 justify-self-end self-center overflow-hidden rounded-md bg-fg-default/6 pl-1 pr-1.5 text-ui-xs font-medium text-fg-default/85",
          authorCollapsed && "!p-0 !bg-transparent",
        )}
        title={commit.author_email || commit.author}
      >
        <span
          className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] font-mono text-ui-2xs font-bold uppercase text-fg-inverse"
          style={{ backgroundColor: authorTint(commit.author_email || commit.author) }}
        >
          {initials}
        </span>
        {!authorCollapsed && <span className="min-w-0 truncate">{commit.author || "Unknown"}</span>}
      </span>

      {/* Date — collapsed: only month+day */}
      <span
        className="pr-6 text-right font-mono text-ui-xs tabular-nums text-fg-muted"
        title={date}
      >
        {dateCollapsed ? date.split(" ").slice(0, 2).join(" ") : date}
      </span>

      {/* Changes — collapsed: only total delta */}
      <span className="flex min-w-0 items-center justify-end gap-1.5 pl-6 font-mono text-ui-xs tabular-nums">
        {changesCollapsed ? (
          totalStat > 0 ? (
            <span
              className={cn(
                "font-semibold",
                commit.insertions >= commit.deletions
                  ? "text-status-success/85 dark:text-status-success/85"
                  : "text-status-error/85 dark:text-status-error/85",
              )}
            >
              {commit.insertions >= commit.deletions ? "+" : "−"}
              {totalStat}
            </span>
          ) : (
            <span className="text-fg-subtle">−</span>
          )
        ) : (
          <>
            {commit.files_changed > 0 ? (
              <span className="text-fg-muted" title={`${commit.files_changed} files changed`}>
                {commit.files_changed}
              </span>
            ) : null}
            {totalStat > 0 ? (
              <span className="inline-flex items-center gap-1">
                {commit.insertions > 0 ? (
                  <span className="font-semibold text-status-success/85 dark:text-status-success/85">
                    +{commit.insertions}
                  </span>
                ) : null}
                {commit.deletions > 0 ? (
                  <span className="font-semibold text-status-error/85 dark:text-status-error/85">
                    −{commit.deletions}
                  </span>
                ) : null}
              </span>
            ) : null}
          </>
        )}
      </span>
    </button>
  );
}
