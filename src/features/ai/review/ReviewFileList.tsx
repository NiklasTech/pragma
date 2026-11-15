import { FileMinus, FilePlus, FileText } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import type { ReviewFileKind, ReviewRow } from "./rows";

const KIND_CLASS: Record<ReviewFileKind, string> = {
  added: "text-git-added",
  modified: "text-git-modified",
  deleted: "text-git-deleted",
};

function KindIcon({ kind }: { kind: ReviewFileKind }) {
  if (kind === "added") return <FilePlus size={13} className="shrink-0 text-git-added" />;
  if (kind === "deleted") return <FileMinus size={13} className="shrink-0 text-git-deleted" />;
  return <FileText size={13} className="shrink-0 text-fg-muted" />;
}

export function ReviewFileList({
  rows,
  selectedRowId,
  onActivate,
  emptyText,
}: {
  rows: ReviewRow[];
  selectedRowId: string | null;
  onActivate: (row: ReviewRow) => void;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="px-3 py-4 text-center text-ui-xs text-fg-subtle">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-0.5 p-1.5">
      {rows.map((row) => (
        <Button
          variant="ghost"
          size="sm"
          key={row.id}
          onClick={() => onActivate(row)}
          title={row.path}
          className={cn(
            "min-w-0 justify-start gap-1.5 px-1.5 text-left font-normal text-fg-default",
            row.id === selectedRowId && "bg-bg-active",
          )}
        >
          <KindIcon kind={row.fileKind} />
          <span className="min-w-0 flex-1 truncate text-ui-xs text-fg-default">{row.path}</span>
          <span className={cn("shrink-0 text-ui-2xs", KIND_CLASS[row.fileKind])}>
            {row.fileKind}
          </span>
        </Button>
      ))}
    </div>
  );
}
