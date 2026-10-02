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
      className="group flex items-center gap-1 rounded-md px-2 pb-0.5 text-left text-ui-2xs font-semibold tracking-wide text-fg-subtle uppercase transition-colors hover:text-fg-default"
    >
      {collapsed ? <CaretRight size={10} /> : <CaretDown size={10} />}
      <FolderSimple size={11} weight="fill" className="shrink-0 text-primary/70" />
      <span className="truncate">{label}</span>
      <span className="rounded-full bg-bg-hover px-1.5 font-medium normal-case tabular-nums">
        {count}
      </span>
    </button>
  );
}
