import type { RefObject } from "react";
import type { ReactVirtualizer } from "@tanstack/react-virtual";
import { Spinner } from "@phosphor-icons/react";
import { ContextMenu, ContextMenuTrigger } from "@/shared/components/ui/context-menu";
import type { GraphRow } from "../lib/gitGraphLayout";
import { CommitRowContextMenu } from "./CommitRowContextMenu";
import { CompactCommitRow } from "./CompactCommitRow";
import type { GitLogEntry, LoadStatus } from "./types";

/// Narrow layout of the history: graph rail plus a two-line commit summary.
export function CommitList({
  virtualizer,
  scrollRef,
  onScroll,
  commits,
  loadStatus,
  endReached,
  activeSha,
  onSetActive,
  graphByCommit,
  maxLaneCount,
  onViewDetails,
  onCopySha,
  onCheckout,
  onCreateBranch,
  onCherryPick,
  onRevert,
  onReset,
  onCreateTag,
  onDeleteTag,
}: {
  virtualizer: ReactVirtualizer<HTMLDivElement, Element>;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  commits: GitLogEntry[];
  loadStatus: LoadStatus;
  endReached: boolean;
  activeSha: string | null;
  onSetActive: (sha: string | null) => void;
  graphByCommit: Map<string, GraphRow>;
  maxLaneCount: number;
  onViewDetails: (sha: string) => void;
  onCopySha: (sha: string) => void;
  onCheckout: (sha: string) => void;
  onCreateBranch: (sha: string) => void;
  onCherryPick: (sha: string) => void;
  onRevert: (sha: string) => void;
  onReset: (sha: string, mode: "soft" | "mixed" | "hard") => void;
  onCreateTag: (sha: string) => void;
  onDeleteTag: (tag: string) => void;
}) {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 min-w-0 flex-1 overflow-y-auto px-1.5 [scrollbar-gutter:stable]"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const commit = commits[virtualRow.index];
          if (!commit) return null;
          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full"
              style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }}
            >
              <ContextMenu>
                <ContextMenuTrigger className="h-full w-full">
                  <CompactCommitRow
                    commit={commit}
                    active={activeSha === commit.sha}
                    isHead={virtualRow.index === 0}
                    graphRow={graphByCommit.get(commit.sha) ?? null}
                    maxLaneCount={maxLaneCount}
                    onClick={() => onViewDetails(commit.sha)}
                  />
                </ContextMenuTrigger>
                <CommitRowContextMenu
                  commit={commit}
                  onViewDetails={(sha) => {
                    onSetActive(sha);
                    onViewDetails(sha);
                  }}
                  onCopySha={onCopySha}
                  onCheckout={onCheckout}
                  onCreateBranch={onCreateBranch}
                  onCherryPick={onCherryPick}
                  onRevert={onRevert}
                  onReset={onReset}
                  onCreateTag={onCreateTag}
                  onDeleteTag={onDeleteTag}
                />
              </ContextMenu>
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
        <div className="py-3 text-center text-ui-2xs text-fg-subtle">Beginning of history</div>
      ) : null}
    </div>
  );
}
