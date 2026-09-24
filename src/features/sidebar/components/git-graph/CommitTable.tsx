import type { RefObject } from "react";
import type { ReactVirtualizer } from "@tanstack/react-virtual";
import { Spinner } from "@phosphor-icons/react";
import { ContextMenu, ContextMenuTrigger } from "@/shared/components/ui/context-menu";
import type { GraphRow } from "../lib/gitGraphLayout";
import { CommitRow } from "./CommitRow";
import { CommitRowContextMenu } from "./CommitRowContextMenu";
import { CommitTableHeader } from "./CommitTableHeader";
import type { ColumnKey } from "./columns";
import { MIN_TABLE_WIDTH, TABLE_HEADER_HEIGHT } from "./constants";
import type { GitLogEntry, LoadStatus } from "./types";

export function CommitTable({
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
  collapsedCols,
  onToggleCol,
  onViewDetails,
  onCopySha,
  onCheckout,
  onCreateBranch,
  onCherryPick,
  onRevert,
  onReset,
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
  collapsedCols: Set<ColumnKey>;
  onToggleCol: (key: ColumnKey) => void;
  onViewDetails: (sha: string) => void;
  onCopySha: (sha: string) => void;
  onCheckout: (sha: string) => void;
  onCreateBranch: (sha: string) => void;
  onCherryPick: (sha: string) => void;
  onRevert: (sha: string) => void;
  onReset: (sha: string, mode: "soft" | "mixed" | "hard") => void;
}) {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 min-w-0 flex-1 overflow-auto [scrollbar-gutter:stable]"
    >
      <div className="px-1.5" style={{ minWidth: MIN_TABLE_WIDTH }}>
        {/* Header */}
        <CommitTableHeader collapsedCols={collapsedCols} onToggleCol={onToggleCol} />

        {/* Rows */}
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
                  transform: `translateY(${virtualRow.start - TABLE_HEADER_HEIGHT}px)`,
                }}
              >
                <ContextMenu>
                  <ContextMenuTrigger className="h-full w-full">
                    <CommitRow
                      commit={commit}
                      active={activeSha === commit.sha}
                      graphRow={graphByCommit.get(commit.sha) ?? null}
                      maxLaneCount={maxLaneCount}
                      collapsedCols={collapsedCols}
                      onClick={() => onSetActive(activeSha === commit.sha ? null : commit.sha)}
                    />
                  </ContextMenuTrigger>
                  <CommitRowContextMenu
                    commit={commit}
                    onViewDetails={onViewDetails}
                    onCopySha={onCopySha}
                    onCheckout={onCheckout}
                    onCreateBranch={onCreateBranch}
                    onCherryPick={onCherryPick}
                    onRevert={onRevert}
                    onReset={onReset}
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
          <div className="py-3 text-center text-ui-xs text-fg-subtle">End of history</div>
        ) : null}
      </div>
    </div>
  );
}
