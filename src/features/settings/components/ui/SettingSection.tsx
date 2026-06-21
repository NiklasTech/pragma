"use client";

import { Separator } from "@/shared/components/ui/separator";

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <div className="flex flex-col">
      <h3 className="text-ui-xs font-medium text-fg-muted uppercase tracking-wider">{title}</h3>
      <Separator className="my-2 bg-border/30" />
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
