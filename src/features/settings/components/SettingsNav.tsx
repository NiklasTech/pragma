import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { CATEGORIES, type Category } from "./settings-categories";

interface SettingsNavProps {
  activeCategory: Category;
  onSelectCategory: (category: Category) => void;
}

export function SettingsNav({ activeCategory, onSelectCategory }: SettingsNavProps) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <nav aria-label="Settings sections" className="flex flex-col gap-0.5 px-2 pb-2">
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const active = activeCategory === category.id;
          return (
            <Button
              variant="ghost"
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "h-8 justify-start gap-2.5 px-2.5 text-left font-normal text-fg-muted",
                active && "bg-bg-active text-fg-default",
              )}
            >
              <Icon size={15} weight={active ? "fill" : "regular"} aria-hidden="true" />
              {category.label}
            </Button>
          );
        })}
      </nav>
    </ScrollArea>
  );
}
