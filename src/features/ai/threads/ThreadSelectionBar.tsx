"use client";

import { Copy, FolderSimple, Trash, X } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { ChatSession } from "@/shared/stores/ai";

import { CategoryMenuItems } from "./CategoryMenuItems";

interface ThreadSelectionBarProps {
  selected: ChatSession[];
  visibleCount: number;
  categories: string[];
  onSelectAll: () => void;
  onClear: () => void;
  onDuplicate: () => void;
  onMove: (category: string | null) => void;
  onNewCategory: () => void;
  onDelete: () => void;
  onExit: () => void;
}

export function ThreadSelectionBar({
  selected,
  visibleCount,
  categories,
  onSelectAll,
  onClear,
  onDuplicate,
  onMove,
  onNewCategory,
  onDelete,
  onExit,
}: ThreadSelectionBarProps) {
  const count = selected.length;
  const allSelected = visibleCount > 0 && count >= visibleCount;
  const shared = selected[0]?.category ?? null;
  const current = selected.every((session) => (session.category ?? null) === shared)
    ? shared
    : null;

  return (
    <div className="flex h-7 items-center gap-1 pr-0.5 pl-2">
      <Checkbox
        checked={allSelected}
        indeterminate={count > 0 && !allSelected}
        onCheckedChange={(checked) => (checked ? onSelectAll() : onClear())}
        aria-label="Select all threads"
      />
      <span className="ml-1 text-ui-xs font-semibold text-fg-default tabular-nums">
        {count} selected
      </span>
      <span className="flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Duplicate selected threads"
        title="Duplicate"
        disabled={count === 0}
        onClick={onDuplicate}
      >
        <Copy size={14} />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={count === 0}
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Move selected threads to a category"
              title="Move to category"
            >
              <FolderSimple size={14} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[180px]">
          <CategoryMenuItems
            categories={categories}
            current={current}
            canRemove={selected.some((session) => session.category)}
            onMove={onMove}
            onNew={onNewCategory}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete selected threads"
        title="Delete"
        disabled={count === 0}
        onClick={onDelete}
        className="hover:text-status-error"
      >
        <Trash size={14} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Exit selection"
        title="Done (Esc)"
        onClick={onExit}
      >
        <X size={14} />
      </Button>
    </div>
  );
}
