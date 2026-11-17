import { type ReactVirtualizer } from "@tanstack/react-virtual";
import { GitStatusRow, type GitStatusRowActions } from "./GitStatusRow";
import { VirtualRow } from "./VirtualRow";
import { type GitRow } from "./rows";

export function GitStatusList({
  scrollRef,
  virtualizer,
  rows,
  ...actions
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  virtualizer: ReactVirtualizer<HTMLDivElement, Element>;
  rows: GitRow[];
} & GitStatusRowActions) {
  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;
          return (
            <VirtualRow key={virtualRow.key} size={virtualRow.size} start={virtualRow.start}>
              <GitStatusRow row={row} {...actions} />
            </VirtualRow>
          );
        })}
      </div>
    </div>
  );
}
