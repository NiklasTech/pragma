import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowsClockwise, GitBranch, MagnifyingGlass } from "@phosphor-icons/react";

import { AgentMark } from "@/shared/components/ui/agent-mark";
import { ActionContextMenu } from "@/shared/components/ui/action-menu";
import { Button } from "@/shared/components/ui/button";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { Input } from "@/shared/components/ui/input";
import { AGENT_STATE_LABELS, StatusDot } from "@/shared/components/ui/status-dot";
import { getWorkspaceName } from "@/shared/lib/workspaceName";
import { cn } from "@/shared/lib/utils";
import { useGitStore } from "@/shared/stores/git";
import { GraphRail } from "@/features/sidebar/components/GraphRail";
import { useGitCompareDialog } from "@/features/sidebar/lib/gitDialogs";
import type { GitLogEntry } from "@/features/sidebar/components/git-graph/types";
import { useGraphLayout } from "@/features/sidebar/components/git-graph/useGraphLayout";
import { useWorktreeAgent } from "@/features/sidebar/worktrees/useWorktreeAgent";
import type { RepositoryWorktree } from "@/features/sidebar/worktrees/worktreeView";
import { useUiSize } from "@/theme/useUiMetrics";

import { CommitDetail } from "./CommitDetail";
import { authorInitial, filterCommits, relativeTime, splitPullRequest } from "./historyModel";
import { useAgentBranchLogs } from "./useAgentBranchLogs";
import { useCommitLog } from "./useCommitLog";

const ROW = 40;
const HEADING = 34;
const NEAR_END = 20;

type Row =
  | { kind: "heading"; key: string; label: string }
  | {
      kind: "agent";
      key: string;
      commit: GitLogEntry;
      worktree: RepositoryWorktree;
      count: number;
      tip: boolean;
    }
  | { kind: "commit"; key: string; commit: GitLogEntry };

function Title({ subject, tags }: { subject: string; tags: readonly string[] }) {
  const { title, pr } = splitPullRequest(subject);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate">{title}</span>
      {pr !== null && <span className="shrink-0 text-ui-xs text-fg-subtle">#{pr}</span>}
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex h-5 shrink-0 items-center rounded-[4px] px-1.75 font-mono text-ui-2xs text-fg-default ring-1 ring-fg-default/20 ring-inset"
        >
          {tag}
        </span>
      ))}
    </span>
  );
}

function AgentRow({ row, now }: { row: Extract<Row, { kind: "agent" }>; now: number }) {
  const { manifest, name, state } = useWorktreeAgent(row.worktree.sessionId);
  return (
    <>
      <span className="flex w-14 shrink-0 justify-center">
        <AgentMark agentId={manifest?.id} name={name} size="sm" />
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-[40%] flex-1">
          <Title subject={row.commit.subject} tags={[]} />
        </span>
        {row.tip && (
          <span
            title={row.worktree.environment.branch}
            className="h-5 max-w-[45%] min-w-0 shrink truncate rounded-[5px] bg-bg-active px-1.75 font-mono text-ui-2xs leading-5 text-fg-default"
          >
            {row.worktree.environment.branch}
          </span>
        )}
      </span>
      <span className="hidden w-36 shrink-0 items-center gap-1.5 truncate text-ui-xs text-fg-muted @min-[620px]:flex">
        {row.tip && <StatusDot state={state} decorative />}
        {row.tip ? `${name}, ${AGENT_STATE_LABELS[state].toLowerCase()}` : name}
      </span>
      <span className="hidden w-20 shrink-0 text-ui-xs text-fg-subtle @min-[440px]:block">
        {relativeTime(row.commit.timestamp_secs, now)}
      </span>
      <span className="w-17 shrink-0 text-right font-mono text-ui-xs text-fg-subtle">
        {row.commit.short_sha}
      </span>
    </>
  );
}

/// The repository's history with the agents' unmerged branches on top, and the selected commit beside it.
export function GitHistoryView() {
  const repoPath = useGitStore((state) => state.repoPath);
  const branch = useGitStore((state) => state.snapshot?.repo.branch ?? null);
  const fetch = useGitStore((state) => state.fetch);
  const log = useCommitLog(repoPath, true);
  const agentLogs = useAgentBranchLogs(repoPath, branch, true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const uiSize = useUiSize();
  const now = Date.now() / 1000;

  const commits = useMemo(() => filterCommits(log.commits, query), [log.commits, query]);
  const { graphByCommit, maxLaneCount } = useGraphLayout(query ? [] : log.commits);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];
    const agentRows = agentLogs.flatMap((agentLog) =>
      filterCommits(agentLog.commits, query).map((commit, index): Row => ({
        kind: "agent",
        key: `agent:${agentLog.worktree.environment.id}:${commit.sha}`,
        commit,
        worktree: agentLog.worktree,
        count: agentLog.commits.length,
        tip: index === 0,
      })),
    );
    if (agentRows.length > 0) {
      list.push({ kind: "heading", key: "heading:agents", label: "Not merged yet" }, ...agentRows);
    }
    list.push({ kind: "heading", key: "heading:main", label: branch ?? "History" });
    for (const commit of commits) list.push({ kind: "commit", key: commit.sha, commit });
    return list;
  }, [agentLogs, commits, branch, query]);

  const firstCommit = rows.find((row) => row.kind !== "heading");
  const selectedRow =
    rows.find((row) => row.kind !== "heading" && row.key === selected) ?? firstCommit ?? null;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => uiSize(rows[index]?.kind === "heading" ? HEADING : ROW),
    overscan: 10,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  const items = virtualizer.getVirtualItems();
  const lastIndex = items[items.length - 1]?.index ?? 0;
  useEffect(() => {
    if (!query && lastIndex >= rows.length - NEAR_END) log.loadMore();
  }, [lastIndex, rows.length, query, log]);

  const runFetch = async () => {
    setFetching(true);
    try {
      await fetch();
    } finally {
      setFetching(false);
    }
  };

  return (
    <section
      aria-label="Git history"
      className="@container flex h-full min-w-0 flex-col bg-bg-root"
    >
      <header className="flex shrink-0 items-center gap-2 py-2 pr-2.5 pl-3.5">
        <span className="font-mono text-[10.5px] tracking-[0.08em] text-fg-subtle uppercase">
          history
        </span>
        <span className="truncate font-mono text-ui-xs text-fg-muted">
          {getWorkspaceName(repoPath)}
        </span>
        <span className="flex h-6 min-w-0 items-center gap-1.5 rounded-[5px] px-2 font-mono text-ui-xs text-fg-default ring-1 ring-fg-default/15 ring-inset">
          <GitBranch size={12} aria-hidden="true" className="shrink-0 text-primary" />
          <span className="truncate">{branch ?? "HEAD"}</span>
        </span>
        {agentLogs.length > 0 && (
          <span className="hidden truncate text-ui-xs text-fg-subtle @min-[640px]:inline">
            and agent branches
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <label className="flex h-7 w-36 items-center gap-2 rounded-[5px] px-2.5 text-fg-subtle ring-1 ring-fg-default/15 ring-inset focus-within:ring-primary/60 @min-[720px]:w-56">
            <MagnifyingGlass size={13} aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search commits"
              aria-label="Search commits"
              className="h-full min-w-0 flex-1 bg-transparent px-0 text-ui-sm ring-0 hover:ring-0 focus-visible:ring-0"
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            title="Fetch"
            aria-label="Fetch"
            disabled={fetching}
            onClick={() => void runFetch()}
          >
            <ArrowsClockwise
              size={13}
              aria-hidden="true"
              className={cn(fetching && "animate-spin motion-reduce:animate-none")}
            />
            <span className="hidden @min-[560px]:inline">fetch</span>
          </Button>
        </span>
      </header>

      <div className="flex min-h-0 flex-1 border-t border-border-subtle">
        <div
          ref={scrollRef}
          role="listbox"
          aria-label="Commits"
          className="@container min-w-0 flex-1 overflow-y-auto px-2 py-1.5"
        >
          {!repoPath && (
            <p className="px-3 py-6 text-ui-sm text-fg-muted">Open a folder to see its history.</p>
          )}
          {repoPath && log.error && log.commits.length === 0 && (
            <p className="px-3 py-6 text-ui-sm text-status-error">{log.error}</p>
          )}
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {items.map((item) => {
              const row = rows[item.index];
              if (!row) return null;
              const style = { height: item.size, transform: `translateY(${item.start}px)` };
              if (row.kind === "heading") {
                return (
                  <div
                    key={item.key}
                    className="absolute top-0 left-0 flex w-full items-end px-2.5 pb-1.5 font-mono text-[10.5px] tracking-[0.08em] text-fg-subtle uppercase"
                    style={style}
                  >
                    {row.label}
                  </div>
                );
              }
              const active = selectedRow?.key === row.key;
              return (
                <ActionContextMenu
                  key={item.key}
                  menu={() => ({
                    head: `${row.commit.short_sha} · ${row.commit.subject}`,
                    tone: row.kind === "agent" ? "info" : "idle",
                    groups: [
                      {
                        items: [
                          {
                            key: "v",
                            label: "view details",
                            shortcut: "⏎",
                            onSelect: () => setSelected(row.key),
                          },
                          {
                            key: "c",
                            label: "copy sha",
                            onSelect: () => void copyToClipboard(row.commit.sha),
                          },
                          {
                            key: "m",
                            label: "copy message",
                            onSelect: () => void copyToClipboard(row.commit.subject),
                          },
                          {
                            key: "d",
                            label: "compare with head",
                            onSelect: () =>
                              useGitCompareDialog.getState().show(row.commit.sha, "HEAD"),
                          },
                        ],
                      },
                    ],
                  })}
                >
                  <Button
                    variant="ghost"
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelected(row.key)}
                    className={cn(
                      "absolute top-0 left-0 flex w-full items-center justify-start gap-3 rounded-[5px] px-1 pr-2.5 text-left text-ui-sm font-normal text-fg-default",
                      active &&
                        "bg-primary/10 ring-1 ring-primary/40 ring-inset hover:bg-primary/10",
                    )}
                    style={style}
                  >
                    {row.kind === "agent" ? (
                      <AgentRow row={row} now={now} />
                    ) : (
                      <>
                        <span className="flex w-14 shrink-0 items-center overflow-hidden">
                          {!query && graphByCommit.get(row.commit.sha) && (
                            <GraphRail
                              row={graphByCommit.get(row.commit.sha)!}
                              rowHeight={uiSize(ROW)}
                              maxLaneCount={maxLaneCount}
                              active={active}
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <Title subject={row.commit.subject} tags={row.commit.tags} />
                        </span>
                        <span className="hidden w-36 shrink-0 items-center gap-1.75 truncate text-ui-xs text-fg-muted @min-[620px]:flex">
                          <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-bg-active text-[9.5px] font-semibold text-fg-default">
                            {authorInitial(row.commit.author)}
                          </span>
                          <span className="truncate">{row.commit.author}</span>
                        </span>
                        <span className="hidden w-20 shrink-0 text-ui-xs text-fg-subtle @min-[440px]:block">
                          {relativeTime(row.commit.timestamp_secs, now)}
                        </span>
                        <span className="w-17 shrink-0 text-right font-mono text-ui-xs text-fg-subtle">
                          {row.commit.short_sha}
                        </span>
                      </>
                    )}
                  </Button>
                </ActionContextMenu>
              );
            })}
          </div>
          {query && rows.every((row) => row.kind === "heading") && (
            <p className="px-3 py-4 text-ui-sm text-fg-muted">
              No loaded commit matches. Scroll further without a search to load older ones.
            </p>
          )}
        </div>

        <aside
          aria-live="polite"
          className="flex w-[min(430px,45%)] min-w-64 shrink-0 flex-col overflow-hidden border-l border-border-subtle bg-bg-well"
        >
          {selectedRow && selectedRow.kind !== "heading" ? (
            <CommitDetail
              key={selectedRow.commit.sha}
              sha={selectedRow.commit.sha}
              stat={{
                added: selectedRow.commit.insertions,
                removed: selectedRow.commit.deletions,
              }}
              agent={
                selectedRow.kind === "agent"
                  ? { worktree: selectedRow.worktree, count: selectedRow.count }
                  : undefined
              }
            />
          ) : (
            <p className="flex flex-1 items-center justify-center text-ui-sm text-fg-muted">
              No commit selected.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
