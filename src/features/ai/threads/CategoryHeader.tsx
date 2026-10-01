"use client";

import { CaretDown, CaretRight, FolderSimple } from "@phosphor-icons/react";

interface CategoryHeaderProps {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function CategoryHeader({ label, count, collapsed, onToggle }: CategoryHeaderProps) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      onClick={onToggle}
      className="flex items-center gap-1 rounded-md px-2 pb-0.5 text-left text-ui-2xs font-medium text-fg-subtle transition-colors hover:text-fg-default"
    >
      {collapsed ? <CaretRight size={10} /> : <CaretDown size={10} />}
      <FolderSimple size={11} className="shrink-0" />
      <span className="truncate">{label}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
