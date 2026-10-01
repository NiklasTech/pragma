"use client";

import { Check, FolderSimple, FolderSimpleMinus, FolderSimplePlus } from "@phosphor-icons/react";

import { DropdownMenuItem, DropdownMenuSeparator } from "@/shared/components/ui/dropdown-menu";

interface CategoryMenuItemsProps {
  categories: string[];
  current: string | null;
  canRemove: boolean;
  onMove: (category: string | null) => void;
  onNew: () => void;
}

export function CategoryMenuItems({
  categories,
  current,
  canRemove,
  onMove,
  onNew,
}: CategoryMenuItemsProps) {
  return (
    <>
      {categories.map((category) => (
        <DropdownMenuItem key={category} onClick={() => onMove(category)}>
          <FolderSimple size={14} />
          <span className="truncate">{category}</span>
          {current === category && <Check size={12} className="ml-auto text-primary" />}
        </DropdownMenuItem>
      ))}
      {categories.length > 0 && <DropdownMenuSeparator />}
      <DropdownMenuItem onClick={onNew}>
        <FolderSimplePlus size={14} />
        New category...
      </DropdownMenuItem>
      {canRemove && (
        <DropdownMenuItem onClick={() => onMove(null)}>
          <FolderSimpleMinus size={14} />
          Remove from category
        </DropdownMenuItem>
      )}
    </>
  );
}
