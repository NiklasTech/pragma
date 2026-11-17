import { useMemo } from "react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";

import { changedSettings } from "../settingChanges";
import { CATEGORIES } from "./settings-categories";
import type { SearchItem } from "./settings-search-items";

/// "changed N" in the filter line: lists every setting that differs from its default.
export function ChangedSettingsMenu({ onSelect }: { onSelect: (item: SearchItem) => void }) {
  const state = useSettingsStore();
  const changed = useMemo(() => changedSettings(state), [state]);
  const count = changed.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            disabled={count === 0}
            title={count === 0 ? "Everything is at its default" : "Settings you changed"}
            className={cn(
              "h-5.5 shrink-0 gap-1.5 px-2 text-[10.5px] ring-1 ring-inset",
              count > 0 ? "text-fg-default ring-primary/45" : "text-fg-subtle ring-fg-default/15",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-[1px]",
                count > 0 ? "bg-primary shadow-[0_0_6px_var(--color-primary)]" : "bg-fg-default/20",
              )}
            />
            changed {count}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Changed from the default</DropdownMenuLabel>
          {changed.map((setting) => (
            <DropdownMenuItem
              key={setting.id}
              onClick={() =>
                onSelect({
                  id: setting.id,
                  label: setting.label,
                  keywords: "",
                  category: setting.category,
                })
              }
            >
              <span className="min-w-0 flex-1 truncate">{setting.label}</span>
              <span className="shrink-0 font-mono text-ui-2xs text-fg-subtle">
                {CATEGORIES.find((category) => category.id === setting.category)?.tab}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
