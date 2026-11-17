import { useMemo } from "react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";

import { changedSettings } from "../settingChanges";

import { CATEGORIES, type Category } from "./settings-categories";

/// The settings areas as one row of short mono tabs; the active one is underlined in orange.
export function SettingsTabs({
  active,
  onSelect,
}: {
  active: Category;
  onSelect: (category: Category) => void;
}) {
  const state = useSettingsStore();
  const counts = useMemo(() => {
    const byArea = new Map<Category, number>();
    for (const setting of changedSettings(state)) {
      byArea.set(setting.category, (byArea.get(setting.category) ?? 0) + 1);
    }
    return byArea;
  }, [state]);

  return (
    <nav
      aria-label="Settings areas"
      className="flex shrink-0 gap-4 overflow-x-auto border-b border-border-subtle px-4 [scrollbar-width:none]"
    >
      {CATEGORIES.map((category) => {
        const on = category.id === active;
        return (
          <Button
            key={category.id}
            variant="ghost"
            aria-current={on ? "page" : undefined}
            title={category.label}
            onClick={() => onSelect(category.id)}
            className={cn(
              "h-auto shrink-0 rounded-none border-b-2 px-0 pt-2.5 pb-2 text-[11.5px] font-normal hover:bg-transparent",
              on
                ? "border-primary text-fg-default"
                : "border-transparent text-fg-subtle hover:text-fg-default",
            )}
          >
            {category.tab}
            {(counts.get(category.id) ?? 0) > 0 && (
              <sup
                aria-label={`${counts.get(category.id)} changed`}
                className="ml-0.5 text-[9px] text-primary"
              >
                {counts.get(category.id)}
              </sup>
            )}
          </Button>
        );
      })}
    </nav>
  );
}
