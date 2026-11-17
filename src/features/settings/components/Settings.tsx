"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Check } from "@phosphor-icons/react";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { Button } from "@/shared/components/ui/button";
import { Kbd } from "@/shared/components/ui/kbd";
import { CATEGORIES, type Category } from "./settings-categories";
import { SettingsSearch } from "./SettingsSearch";
import { SettingsTabs } from "./SettingsTabs";
import { SettingsActions } from "./SettingsActions";
import { SettingsCategoryContent } from "./SettingsCategoryContent";
import { revealSetting } from "./revealSetting";
import type { SearchItem } from "./settings-search-items";

export function Settings({
  initialCategory,
  initialReveal,
  onClose,
}: {
  initialCategory?: Category;
  /** Label of a setting or section to scroll to when the overlay opens. */
  initialReveal?: string;
  /** Shows Close in the header; the overlay passes it. */
  onClose?: () => void;
}) {
  const [activeCategory, setActiveCategory] = React.useState<Category>(initialCategory ?? "agents");
  const [query, setQuery] = React.useState("");
  const [saveIndicator, setSaveIndicator] = React.useState<"idle" | "saved">("idle");
  // A new object per selection, so picking the same result again scrolls to it again.
  const [reveal, setReveal] = React.useState<{ target: string } | null>(
    initialReveal ? { target: initialReveal } : null,
  );
  const contentRef = React.useRef<HTMLDivElement>(null);

  const handleSelectCategory = (category: Category) => {
    setActiveCategory(category);
    setQuery("");
    setReveal(null);
  };

  const handleSelectResult = (item: SearchItem) => {
    handleSelectCategory(item.category);
    setReveal({ target: item.target ?? item.label });
  };

  React.useEffect(() => {
    if (!reveal || !contentRef.current) return;
    return revealSetting(contentRef.current, reveal.target);
  }, [reveal]);

  const activeCategoryDef = CATEGORIES.find((c) => c.id === activeCategory);

  React.useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const unsub = useSettingsStore.subscribe(() => {
      setSaveIndicator("saved");
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setSaveIndicator("idle"), 1500);
    });
    return () => {
      unsub();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSaveIndicator("saved");
        const timeout = setTimeout(() => setSaveIndicator("idle"), 1500);
        return () => clearTimeout(timeout);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <TooltipProvider delay={100}>
      <div
        className="flex h-full min-h-0 flex-col"
        data-settings-wide={activeCategoryDef?.wide || undefined}
      >
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border-subtle pr-2 pl-4 font-mono text-[12.5px]">
          <span className="font-semibold text-fg-default">settings</span>
          <span aria-hidden="true" className="text-fg-subtle">
            ›
          </span>
          <span className="truncate text-fg-muted">{activeCategoryDef?.tab ?? "settings"}</span>
          <span
            className={cn(
              "ml-2 inline-flex items-center gap-1 text-ui-2xs text-status-success transition-opacity duration-200",
              saveIndicator === "saved" ? "opacity-100" : "opacity-0",
            )}
            aria-live="polite"
          >
            <Check size={11} />
            saved
          </span>
          <span className="ml-auto flex items-center gap-1">
            <SettingsActions />
            {onClose && (
              <Button
                variant="ghost"
                size="xs"
                onClick={onClose}
                aria-label="Close settings"
                className="ml-1 px-1"
              >
                <Kbd>esc</Kbd>
              </Button>
            )}
          </span>
        </header>

        <SettingsTabs active={activeCategory} onSelect={handleSelectCategory} />

        <SettingsSearch
          query={query}
          onQueryChange={setQuery}
          onSelectResult={handleSelectResult}
        />

        <ScrollArea className="min-h-0 flex-1">
          <div ref={contentRef} className="w-full px-4 pt-3 pb-10 pl-7">
            {activeCategoryDef && (
              <p className="-ml-3 pb-1 text-ui-xs text-fg-subtle">
                {activeCategoryDef.description}
              </p>
            )}
            <SettingsCategoryContent category={activeCategory} />
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
