import { cn } from "@/shared/lib/utils";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { CATEGORIES, CATEGORY_GROUPS, type Category } from "./settings-categories";

interface SettingsNavProps {
  activeCategory: Category;
  onSelectCategory: (category: Category) => void;
}

export function SettingsNav({ activeCategory, onSelectCategory }: SettingsNavProps) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="flex flex-col gap-3 px-2 pb-2">
        {CATEGORY_GROUPS.map((group) => (
          <div key={group} className="flex flex-col gap-0.5">
            <span className="px-2.5 pb-1 text-ui-2xs font-medium text-fg-subtle">{group}</span>
            {CATEGORIES.filter((category) => category.group === group).map((category) => {
              const Icon = category.icon;
              const active = activeCategory === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onSelectCategory(category.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-left text-ui-sm transition-colors",
                    active
                      ? "bg-bg-hover font-medium text-fg-default"
                      : "text-fg-muted hover:bg-bg-hover hover:text-fg-default",
                  )}
                >
                  <Icon
                    size={16}
                    weight={active ? "fill" : "regular"}
                    className={active ? "text-primary" : undefined}
                  />
                  {category.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
