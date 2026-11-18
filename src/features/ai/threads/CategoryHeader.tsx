"use client";

import { CaretDown, CaretRight, FolderSimple } from "@phosphor-icons/react";
import { Button } from "@/shared/components/ui/button";

interface CategoryHeaderProps {
  label: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

export function CategoryHeader({ label, count, collapsed, onToggle }: CategoryHeaderProps) {
  return (
    <Button
      variant="ghost"
      size="xs"
      aria-expanded={!collapsed}
      onClick={onToggle}
      className="group justify-start gap-1 px-2 text-left text-ui-2xs font-semibold tracking-wide text-fg-subtle uppercase hover:bg-transparent"
    >
      {collapsed ? <CaretRight size={10} /> : <CaretDown size={10} />}
      <FolderSimple size={11} weight="fill" className="shrink-0 text-primary" />
      <span className="truncate">{label}</span>
      <span className="rounded-full bg-bg-hover px-1.5 font-medium normal-case tabular-nums">
        {count}
      </span>
    </Button>
  );
}
