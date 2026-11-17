import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import { CATEGORIES, type Category } from "./settings-categories";

/// The settings areas as one row of short mono tabs; the active one is underlined in orange.
export function SettingsTabs({
  active,
  onSelect,
}: {
  active: Category;
  onSelect: (category: Category) => void;
}) {
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
          </Button>
        );
      })}
    </nav>
  );
}
