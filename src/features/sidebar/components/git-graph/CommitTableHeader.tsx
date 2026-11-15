import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { ALL_COLUMNS, type ColumnKey } from "./columns";
import { GRID_COLUMNS, TABLE_HEADER_HEIGHT } from "./constants";
import { useUiSize } from "@/theme/useUiMetrics";

export function CommitTableHeader({
  collapsedCols,
  onToggleCol,
}: {
  collapsedCols: Set<ColumnKey>;
  onToggleCol: (key: ColumnKey) => void;
}) {
  const uiSize = useUiSize();
  return (
    <div
      className="sticky top-0 z-10 grid items-center gap-5 border-b border-border bg-bg-surface pr-3 text-ui-sm font-medium text-fg-muted select-none"
      style={{
        height: uiSize(TABLE_HEADER_HEIGHT),
        gridTemplateColumns: GRID_COLUMNS,
      }}
    >
      <div />
      {ALL_COLUMNS.map((col) => {
        const isCollapsed = collapsedCols.has(col.key);
        return (
          <Button
            variant="ghost"
            size="xs"
            key={col.key}
            onClick={() => onToggleCol(col.key)}
            className={cn(
              "h-auto justify-start gap-1 rounded-none p-0 text-ui-sm font-medium text-fg-muted hover:bg-transparent",
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
          </Button>
        );
      })}
    </div>
  );
}
