"use client";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore, type StatusbarItem } from "@/shared/stores/settings";
import { cn } from "@/shared/lib/utils";
import { ArrowUp, ArrowDown, ArrowCounterClockwise } from "@phosphor-icons/react";

const ITEM_LABELS: Record<StatusbarItem, string> = {
  vimMode: "Vim Mode",
  cursor: "Cursor Position",
  fileType: "File Type",
  encoding: "Encoding",
  eol: "Line Ending",
  gitBranch: "Git Branch",
  gitSync: "Git Sync Status",
  problems: "Problems",
  aiProvider: "AI Provider",
  theme: "Theme",
};

const DEFAULT_ITEMS: StatusbarItem[] = [
  "vimMode",
  "cursor",
  "fileType",
  "encoding",
  "eol",
  "gitBranch",
  "gitSync",
  "problems",
  "aiProvider",
  "theme",
];

export function StatusbarSettings() {
  const { statusbar, setStatusbarSettings } = useSettingsStore();

  const toggleItem = (item: StatusbarItem) => {
    const next = statusbar.items.includes(item)
      ? statusbar.items.filter((i) => i !== item)
      : [...statusbar.items, item];
    setStatusbarSettings({ items: next });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const next = [...statusbar.items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setStatusbarSettings({ items: next });
  };

  const reset = () => {
    setStatusbarSettings({ visible: true, items: DEFAULT_ITEMS });
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Statusbar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="statusbar-visible">
              Show Statusbar
            </Label>
            <Switch
              id="statusbar-visible"
              checked={statusbar.visible}
              onCheckedChange={(v) => setStatusbarSettings({ visible: v })}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Visible Items</Label>
            <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-bg-root p-1">
              {statusbar.items.map((item, index) => (
                <div
                  key={item}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-bg-hover"
                >
                  <span className="text-ui-sm text-fg-default">{ITEM_LABELS[item]}</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default",
                        index === 0 && "opacity-40",
                      )}
                      aria-label={`Move ${ITEM_LABELS[item]} up`}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === statusbar.items.length - 1}
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-default",
                        index === statusbar.items.length - 1 && "opacity-40",
                      )}
                      aria-label={`Move ${ITEM_LABELS[item]} down`}
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {statusbar.items.length === 0 && (
                <div className="px-2 py-3 text-center text-ui-xs text-fg-muted">
                  No items enabled.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Available Items</Label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_ITEMS.map((item) => {
                const active = statusbar.items.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleItem(item)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-ui-xs transition-colors",
                      active
                        ? "border-primary/50 bg-accent-subtle text-primary"
                        : "border-border/60 bg-bg-root text-fg-muted hover:border-border hover:text-fg-default",
                    )}
                  >
                    {ITEM_LABELS[item]}
                  </button>
                );
              })}
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={reset} className="gap-1 self-start">
            <ArrowCounterClockwise size={12} />
            Reset to Default
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
