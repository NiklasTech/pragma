"use client";

import { CaretDown, CaretRight, FolderSimple } from "@phosphor-icons/react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { RepositoryColorDot } from "@/shared/components/RepositoryColorDot";

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
    <Button
      variant="ghost"
      size="xs"
      aria-expanded={!collapsed}
      title={path}
      onClick={onToggle}
      className="justify-start gap-1.5 px-2 text-left text-ui-xs font-semibold text-fg-default"
    >
      {collapsed ? <CaretRight size={10} /> : <CaretDown size={10} />}
      <FolderSimple
        size={13}
        weight={active ? "fill" : "regular"}
        className={cn("shrink-0", active ? "text-primary" : "text-fg-subtle")}
      />
      <RepositoryColorDot path={path} />
      <span className="truncate">{name}</span>
      <span className="rounded-full bg-bg-hover px-1.5 text-ui-2xs font-medium text-fg-muted tabular-nums">
        {count}
      </span>
    </Button>
  );
}
