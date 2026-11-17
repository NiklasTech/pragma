import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ChangedSettingsMenu } from "./ChangedSettingsMenu";
import { CATEGORIES } from "./settings-categories";
import { SEARCH_ITEMS, type SearchItem } from "./settings-search-items";

interface SettingsSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSelectResult: (item: SearchItem) => void;
}

export function SettingsSearch({ query, onQueryChange, onSelectResult }: SettingsSearchProps) {
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
    <div className="relative shrink-0 px-4 pt-2.5">
      <label className="flex h-8 items-center gap-2.5 border-b border-fg-default/15 font-mono focus-within:border-primary/60">
        <span aria-hidden="true" className="font-semibold text-primary">
          /
        </span>
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="filter all settings"
          aria-label="Search settings"
          className="h-full min-w-0 flex-1 bg-transparent px-0 font-mono text-ui-sm ring-0 hover:ring-0 focus-visible:ring-0"
        />
        <ChangedSettingsMenu onSelect={onSelectResult} />
      </label>

      {(filteredItems.length > 0 || query.trim()) && (
        <div className="absolute top-full right-4 left-4 z-50 mt-1 max-h-80 overflow-y-auto rounded-[6px] bg-bg-elevated p-1 shadow-[var(--shadow-md)] ring-1 ring-border">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <Button
                variant="ghost"
                key={item.id}
                onClick={() => onSelectResult(item)}
                className="h-auto w-full items-baseline justify-start gap-2 px-2 py-1.5 text-left font-normal whitespace-normal"
              >
                <span className="font-sans text-ui-sm text-fg-default">{item.label}</span>
                <span className="ml-auto shrink-0 text-ui-2xs text-fg-subtle">
                  {CATEGORIES.find((c) => c.id === item.category)?.tab}
                </span>
              </Button>
            ))
          ) : (
            <div className="px-2 py-1.5 text-ui-xs text-fg-subtle">No settings found.</div>
          )}
        </div>
      )}
    </div>
  );
}
