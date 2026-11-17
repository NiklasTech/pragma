import { type ReactVirtualizer } from "@tanstack/react-virtual";
import { type GitStatusEntry } from "@/shared/stores/git";
import { GitStatusRow } from "./GitStatusRow";
import { VirtualRow } from "./VirtualRow";
import { type GitRow } from "./rows";

export function GitStatusList({
  scrollRef,
  virtualizer,
  rows,
  actionBusy,
  onOpenConflict,
  historyExpanded,
  onToggleHistory,
  onStageAll,
  onUnstageAll,
  onToggleStaged,
  onToggleUnstaged,
  onSelectFile,
  onOpenDiff,
  onDiscard,
  isSelected,
  repoLabel,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  virtualizer: ReactVirtualizer<HTMLDivElement, Element>;
  rows: GitRow[];
  actionBusy: string | null;
  onOpenConflict: (path: string) => void;
  historyExpanded: boolean;
  onToggleHistory: () => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onToggleStaged: (entry: GitStatusEntry) => void;
  onToggleUnstaged: (entry: GitStatusEntry) => void;
  onSelectFile: (entry: GitStatusEntry) => void;
  onOpenDiff: (entry: GitStatusEntry, staged: boolean) => void;
  onDiscard: (entry: GitStatusEntry) => void;
  isSelected: (path: string) => boolean;
  repoLabel: string;
}) {
  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;

          return (
            <VirtualRow key={virtualRow.key} size={virtualRow.size} start={virtualRow.start}>
              <GitStatusRow
                row={row}
                actionBusy={actionBusy}
                onOpenConflict={onOpenConflict}
                historyExpanded={historyExpanded}
                onToggleHistory={onToggleHistory}
                onStageAll={onStageAll}
                onUnstageAll={onUnstageAll}
                onToggleStaged={onToggleStaged}
                onToggleUnstaged={onToggleUnstaged}
                onSelectFile={onSelectFile}
                onOpenDiff={onOpenDiff}
                onDiscard={onDiscard}
                isSelected={isSelected}
                repoLabel={repoLabel}
              />
            </VirtualRow>
          );
        })}
      </div>
    </div>
  );
}
