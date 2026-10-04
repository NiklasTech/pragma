import * as React from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/shared/components/ui/input";
import { CATEGORIES, type Category } from "./settings-categories";
import { SEARCH_ITEMS } from "./settings-search-items";

interface SettingsSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSelectCategory: (category: Category) => void;
}

export function SettingsSearch({ query, onQueryChange, onSelectCategory }: SettingsSearchProps) {
  const filteredItems = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return SEARCH_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(normalized) ||
        item.keywords.toLowerCase().includes(normalized),
    );
  }, [query]);

  return (
    <div className="relative shrink-0 p-3">
      <MagnifyingGlass
        size={14}
        className="absolute top-1/2 left-5.5 -translate-y-1/2 text-fg-subtle"
      />
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search settings"
        className="h-8 rounded-lg pl-8 text-ui-sm"
      />

      {(filteredItems.length > 0 || query.trim()) && (
        <div className="absolute top-full right-0 left-0 z-50 mx-3 -mt-1 rounded-lg border border-border bg-bg-elevated/95 p-1 shadow-[var(--shadow-md)] backdrop-blur-xl">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectCategory(item.category)}
                className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
              >
                <span className="text-ui-sm text-fg-default">{item.label}</span>
                <span className="text-ui-xs text-fg-subtle">
                  {CATEGORIES.find((c) => c.id === item.category)?.label}
                </span>
              </button>
            ))
          ) : (
            <div className="px-2 py-1.5 text-ui-xs text-fg-subtle">No settings found.</div>
          )}
        </div>
      )}
    </div>
  );
}
