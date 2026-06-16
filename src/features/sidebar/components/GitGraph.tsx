import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { invoke } from "@tauri-apps/api/core";
import { useGitStore } from "@/shared/stores/git";
import { Spinner, CaretDown, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { GraphRail, railWidth, MAX_VISIBLE_LANES } from "./GraphRail";
import { EMPTY_GRAPH_STATE, layoutGraph, type GraphRow } from "./lib/gitGraphLayout";

const RAIL_RESERVED_PX = railWidth(MAX_VISIBLE_LANES);

const PAGE_SIZE = 30;
const ROW_HEIGHT = 28;
const TABLE_HEADER_HEIGHT = 24;
const GRID_COLUMNS = `${RAIL_RESERVED_PX + 4}px 60px minmax(0, 2fr) minmax(0, 1fr) 90px 76px`;
const NEAR_BOTTOM_PX = 240;

/* ─── Column configuration ─────────────────────────────────────────────── */

type ColumnKey = "sha" | "subject" | "author" | "date" | "changes";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  align: "left" | "right";
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "sha", label: "SHA", align: "left" },
  { key: "subject", label: "Subject", align: "left" },
  { key: "author", label: "Author", align: "left" },
  { key: "date", label: "Date", align: "right" },
  { key: "changes", label: "Δ", align: "right" },
];

/* ─── Utilities ────────────────────────────────────────────────────────── */

interface GitLogEntry {
  sha: string;
  short_sha: string;
  author: string;
  author_email: string;
  timestamp_secs: number;
  parents: string[];
  subject: string;
  files_changed: number;
  insertions: number;
  deletions: number;
}

function normalizeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Unknown error";
}

function compactDate(secs: number): string {
  if (!secs) return "";
  const d = new Date(secs * 1000);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const month = d.toLocaleString(undefined, { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  if (sameYear) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${month} ${day} ${hh}:${mm}`;
  }
  return `${month} ${day} ${d.getFullYear()}`;
}

function authorInitials(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AUTHOR_TINTS = [
  "#7aa2f7",
  "#bb9af7",
  "#9ece6a",
  "#e0af68",
  "#f7768e",
  "#73daca",
  "#ff9e64",
  "#b4f9f8",
];

function authorTint(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return AUTHOR_TINTS[Math.abs(hash) % AUTHOR_TINTS.length];
}

/* ─── Main component ───────────────────────────────────────────────────── */

export function GitGraph() {
  const { repoPath } = useGitStore();
  const [commits, setCommits] = useState<GitLogEntry[]>([]);
  const [loadStatus, setLoadStatus] = useState<"idle" | "initial" | "more" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [endReached, setEndReached] = useState(false);
  const [activeSha, setActiveSha] = useState<string | null>(null);
  const [collapsedCols, setCollapsedCols] = useState<Set<ColumnKey>>(new Set());

  const requestIdRef = useRef(0);
  const inflightMoreRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const graphCacheRef = useRef<{
    rows: GraphRow[];
    byCommit: Map<string, GraphRow>;
    tail: typeof EMPTY_GRAPH_STATE;
    firstSha: string | null;
    len: number;
    maxLaneCount: number;
  }>({
    rows: [],
    byCommit: new Map(),
    tail: EMPTY_GRAPH_STATE,
    firstSha: null,
    len: 0,
    maxLaneCount: 1,
  });

  const { graphByCommit, maxLaneCount } = useMemo(() => {
    const cache = graphCacheRef.current;
    if (commits.length === 0) {
      cache.rows = [];
      cache.byCommit = new Map();
      cache.tail = EMPTY_GRAPH_STATE;
      cache.firstSha = null;
      cache.len = 0;
      cache.maxLaneCount = 1;
      return { graphByCommit: cache.byCommit, maxLaneCount: 1 };
    }
    const firstSha = commits[0].sha;
    const canAppend = cache.firstSha === firstSha && commits.length >= cache.len;
    if (!canAppend) {
      const { rows, state } = layoutGraph(commits);
      const byCommit = new Map<string, GraphRow>();
      let max = 1;
      for (const row of rows) {
        byCommit.set(row.sha, row);
        if (row.laneCount > max) max = row.laneCount;
      }
      cache.rows = rows;
      cache.byCommit = byCommit;
      cache.tail = state;
      cache.firstSha = firstSha;
      cache.len = commits.length;
      cache.maxLaneCount = max;
      return { graphByCommit: byCommit, maxLaneCount: max };
    }
    if (commits.length > cache.len) {
      const delta = commits.slice(cache.len);
      const { rows: newRows, state } = layoutGraph(delta, cache.tail);
      let max = cache.maxLaneCount;
      for (const row of newRows) {
        cache.byCommit.set(row.sha, row);
        if (row.laneCount > max) max = row.laneCount;
      }
      cache.rows = cache.rows.concat(newRows);
      cache.tail = state;
      cache.len = commits.length;
      cache.maxLaneCount = max;
    }
    return { graphByCommit: cache.byCommit, maxLaneCount: cache.maxLaneCount };
  }, [commits]);

  const virtualizer = useVirtualizer({
    count: commits.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => commits[index]?.sha ?? index,
  });

  const loadInitial = useCallback(async () => {
    if (!repoPath) return;
    const requestId = ++requestIdRef.current;
    setLoadStatus("initial");
    setError(null);
    setEndReached(false);
    try {
      const result = await invoke<{ entries: GitLogEntry[] }>("git_log_entries", {
        repoPath,
        limit: PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;
      setCommits(result.entries);
      setLoadStatus("idle");
      if (result.entries.length < PAGE_SIZE) setEndReached(true);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(normalizeError(err));
      setLoadStatus("error");
    }
  }, [repoPath]);

  const loadMore = useCallback(async () => {
    if (!repoPath || inflightMoreRef.current || endReached) return;
    if (loadStatus !== "idle") return;
    const last = commits[commits.length - 1];
    if (!last) return;
    inflightMoreRef.current = true;
    setLoadStatus("more");
    try {
      const result = await invoke<{ entries: GitLogEntry[] }>("git_log_entries", {
        repoPath,
        limit: PAGE_SIZE,
        beforeSha: last.sha,
      });
      setCommits((prev) => {
        const seen = new Set(prev.map((c) => c.sha));
        const merged = [...prev];
        for (const e of result.entries) if (!seen.has(e.sha)) merged.push(e);
        return merged;
      });
      if (result.entries.length < PAGE_SIZE) setEndReached(true);
      setLoadStatus("idle");
    } catch (err) {
      setError(normalizeError(err));
      setLoadStatus("error");
    } finally {
      inflightMoreRef.current = false;
    }
  }, [commits, endReached, loadStatus, repoPath]);

  useEffect(() => {
    setCommits([]);
    setActiveSha(null);
    if (repoPath) void loadInitial();
  }, [repoPath, loadInitial]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < NEAR_BOTTOM_PX) {
      void loadMore();
    }
  }, [loadMore]);

  useEffect(() => {
    if (loadStatus !== "idle" || endReached || commits.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable > NEAR_BOTTOM_PX) return;
    const id = window.setTimeout(() => void loadMore(), 0);
    return () => window.clearTimeout(id);
  }, [commits.length, endReached, loadMore, loadStatus]);

  const toggleCol = useCallback((key: ColumnKey) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!repoPath) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-fg-muted">Open a folder to view Git history</p>
      </div>
    );
  }

  if (loadStatus === "initial" && commits.length === 0) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-ui-xs text-fg-muted">
        <Spinner size={16} className="animate-spin" />
        Loading commits…
      </div>
    );
  }

  if (loadStatus === "error" && commits.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-ui-base font-medium text-fg-default">Could not load history</div>
        <div className="max-w-md text-ui-xs text-fg-muted">{error ?? "Unknown error"}</div>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="text-ui-base font-medium text-fg-default">No commits yet</div>
        <div className="max-w-md text-ui-xs text-fg-muted">This branch has no commits.</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-x-hidden">
      {/* Header */}
      <div
        className="grid shrink-0 items-center gap-5 border-b border-border/40 bg-bg-surface pr-3 text-ui-2xs font-semibold uppercase tracking-[0.12em] text-fg-muted select-none"
        style={{
          height: TABLE_HEADER_HEIGHT,
          gridTemplateColumns: GRID_COLUMNS,
        }}
      >
        <div />
        {ALL_COLUMNS.map((col) => {
          const isCollapsed = collapsedCols.has(col.key);
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => toggleCol(col.key)}
              className={cn(
                "flex items-center gap-1 transition-colors hover:text-fg-default",
                col.align === "right" && "justify-end",
                col.key === "sha" && "pl-px",
                col.key === "author" && "justify-end",
                col.key === "date" && "pr-6",
                col.key === "changes" && "pl-6",
              )}
              title={isCollapsed ? `Expand ${col.label}` : `Collapse ${col.label}`}
            >
              <span className="inline-block w-2.5">
                {isCollapsed ? (
                  <CaretRight size={9} weight="bold" />
                ) : (
                  <CaretDown size={9} weight="bold" />
                )}
              </span>
              <span className={cn(isCollapsed && "sr-only")}>{col.label}</span>
            </button>
          );
        })}
      </div>

      {/* Rows */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: "relative",
            width: "100%",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const commit = commits[virtualRow.index];
            if (!commit) return null;
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <CommitRow
                  commit={commit}
                  active={activeSha === commit.sha}
                  graphRow={graphByCommit.get(commit.sha) ?? null}
                  maxLaneCount={maxLaneCount}
                  collapsedCols={collapsedCols}
                  onClick={() => setActiveSha(activeSha === commit.sha ? null : commit.sha)}
                />
              </div>
            );
          })}
        </div>

        {loadStatus === "more" ? (
          <div className="flex items-center justify-center gap-2 py-3 text-ui-xs text-fg-muted">
            <Spinner size={12} className="animate-spin" />
            Loading more…
          </div>
        ) : null}
        {endReached ? (
          <div className="py-3 text-center text-ui-xs text-fg-subtle">End of history</div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Row component ────────────────────────────────────────────────────── */

function CommitRow({
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
        "group relative grid h-full w-full cursor-pointer items-center gap-5 border-l-2 border-transparent pr-3 text-left transition-colors",
        active ? "border-l-primary/70 bg-bg-active" : "hover:bg-bg-hover",
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

      {/* SHA — collapsed: nur erste 4 chars */}
      <span
        className={cn(
          "pl-px font-mono text-ui-2xs tabular-nums text-fg-muted",
          shaCollapsed && "text-ui-xs",
        )}
        title={commit.short_sha}
      >
        {shaCollapsed ? commit.short_sha.slice(0, 4) : commit.short_sha}
      </span>

      {/* Subject — collapsed: kleinere Schrift */}
      <span
        className={cn(
          "min-w-0 truncate text-ui-xs leading-tight",
          active ? "font-semibold text-fg-default" : "font-medium text-fg-default/95",
          subjectCollapsed && "text-ui-2xs opacity-70",
        )}
        title={commit.subject}
      >
        {commit.subject || <span className="text-fg-muted">(no subject)</span>}
      </span>

      {/* Author — collapsed: nur Avatar */}
      <span
        className={cn(
          "mr-2 inline-flex h-[16px] max-w-full min-w-0 items-center gap-1.5 justify-self-end self-center overflow-hidden rounded-md bg-fg-default/6 pl-1 pr-1.5 text-ui-2xs font-medium text-fg-default/85",
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

      {/* Date — collapsed: nur Monat+Tag */}
      <span
        className="pr-6 text-right font-mono text-ui-xs tabular-nums text-fg-muted/75"
        title={date}
      >
        {dateCollapsed ? date.split(" ").slice(0, 2).join(" ") : date}
      </span>

      {/* Changes — collapsed: nur Gesamt-Δ */}
      <span className="flex min-w-0 items-center justify-end gap-1.5 pl-6 font-mono text-ui-2xs tabular-nums">
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
