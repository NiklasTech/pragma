"use client";

import * as React from "react";
import { cn } from "@/shared/lib/utils";
import { useSettingsStore } from "@/shared/stores/settings";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Check } from "@phosphor-icons/react";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { CATEGORIES, type Category } from "./settings-categories";
import { SettingsSearch } from "./SettingsSearch";
import { SettingsNav } from "./SettingsNav";
import { SettingsActions } from "./SettingsActions";
import { SettingsCategoryContent } from "./SettingsCategoryContent";

export function Settings() {
  const [activeCategory, setActiveCategory] = React.useState<Category>("editor");
  const [query, setQuery] = React.useState("");
  const [saveIndicator, setSaveIndicator] = React.useState<"idle" | "saved">("idle");

  const handleSelectCategory = (category: Category) => {
    setActiveCategory(category);
    setQuery("");
  };

  const activeCategoryDef = CATEGORIES.find((c) => c.id === activeCategory);
  const activeLabel = activeCategoryDef?.label ?? "Settings";

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
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 gap-0">
          <div className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-border-subtle bg-bg-chrome/40">
            <SettingsSearch
              query={query}
              onQueryChange={setQuery}
              onSelectCategory={handleSelectCategory}
            />
            <SettingsNav activeCategory={activeCategory} onSelectCategory={handleSelectCategory} />
            <SettingsActions />
          </div>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="mx-auto flex w-full max-w-3xl shrink-0 items-start justify-between gap-4 px-8 pt-7 pb-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-xl font-semibold tracking-tight text-fg-default">
                  {activeLabel}
                </h2>
                {activeCategoryDef && (
                  <p className="text-ui-sm text-fg-subtle">{activeCategoryDef.description}</p>
                )}
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-ui-xs text-status-success transition-opacity duration-200",
                  saveIndicator === "saved" ? "opacity-100" : "opacity-0",
                )}
                aria-live="polite"
              >
                <Check size={12} />
                Saved
              </span>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto w-full max-w-3xl px-8 pb-10">
                <SettingsCategoryContent category={activeCategory} />
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
