"use client";

import { CaretDown, CaretRight, FolderSimple } from "@phosphor-icons/react";

import { cn } from "@/shared/lib/utils";

interface RepositoryGroupHeaderProps {
  name: string;
  path: string;
  count: number;
  active: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

export function RepositoryGroupHeader({
  name,
  path,
  count,
  active,
  collapsed,
  onToggle,
}: RepositoryGroupHeaderProps) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      title={path}
      onClick={onToggle}
      className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-left text-ui-xs font-semibold text-fg-default transition-colors hover:bg-bg-hover"
    >
      {collapsed ? <CaretRight size={10} /> : <CaretDown size={10} />}
      <FolderSimple
        size={13}
        weight={active ? "fill" : "regular"}
        className={cn("shrink-0", active ? "text-primary" : "text-fg-subtle")}
      />
      <span className="truncate">{name}</span>
      <span className="rounded-full bg-bg-hover px-1.5 text-ui-2xs font-medium text-fg-muted tabular-nums">
        {count}
      </span>
    </button>
  );
}
