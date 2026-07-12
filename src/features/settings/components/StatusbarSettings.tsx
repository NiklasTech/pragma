"use client";

import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore, type StatusbarItem } from "@/shared/stores/settings";
import { cn } from "@/shared/lib/utils";
import { ArrowUp, ArrowDown, ArrowCounterClockwise } from "@phosphor-icons/react";
import { SettingSection } from "./ui/SettingSection";
import { SettingRow } from "./ui/SettingRow";

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
    <SettingSection title="Statusbar">
      <SettingRow
        label="Show Statusbar"
        description="Display the statusbar at the bottom of the window"
        control={
          <Switch
            checked={statusbar.visible}
            onCheckedChange={(v) => setStatusbarSettings({ visible: v })}
          />
        }
      />

      <div className="py-2.5">
        <span className="text-ui-sm text-fg-default">Visible Items</span>
        <div className="mt-1.5 flex flex-col">
          {statusbar.items.map((item, index) => (
            <div
              key={item}
              className="flex items-center justify-between gap-2 border-b border-border-subtle py-1.5 last:border-b-0"
            >
              <span className="text-ui-sm text-fg-default">{ITEM_LABELS[item]}</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.92] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:bg-bg-hover hover:text-fg-default",
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
                    "flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.92] outline-none focus-visible:ring-2 focus-visible:ring-primary/40 hover:bg-bg-hover hover:text-fg-default",
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
            <div className="py-3 text-center text-ui-xs text-fg-muted">No items enabled.</div>
          )}
        </div>
      </div>

      <div className="py-2.5">
        <span className="text-ui-sm text-fg-default">Available Items</span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DEFAULT_ITEMS.map((item) => {
            const active = statusbar.items.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleItem(item)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-ui-xs transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  active
                    ? "border-[color-mix(in_srgb,var(--color-primary)_50%,transparent)] bg-accent-subtle text-primary"
                    : "border-border-subtle bg-bg-root text-fg-muted hover:border-border hover:text-fg-default",
                )}
              >
                {ITEM_LABELS[item]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-start py-2.5">
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          className="gap-1 transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ArrowCounterClockwise size={12} />
          Reset to Default
        </Button>
      </div>
    </SettingSection>
  );
}
