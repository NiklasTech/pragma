"use client";

import * as React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/shared/components/ui/button";
import { useTheme, builtInThemeList } from "@/theme";
import { validateTheme } from "@/theme/validateTheme";
import type { Theme, ThemeInput } from "@/theme/types";
import { Check, Trash, UploadSimple } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { SettingSection } from "./ui/SettingSection";

function getThemePreviewColors(theme: Theme): [string, string, string, string] {
  const tokens = theme.tokens;
  const bg = tokens.colors?.background?.root ?? tokens.editor?.background ?? "#1a1b26";
  const fg = tokens.colors?.foreground?.default ?? tokens.editor?.foreground ?? "#c0caf5";
  const primary = tokens.colors?.accent?.default ?? "#7aa2f7";
  const accent = tokens.colors?.accent?.subtle ?? "#565f89";
  return [bg, fg, primary, accent];
}

export function ThemeSettings() {
  const { themeId, setTheme, availableThemes, addCustomTheme, deleteCustomTheme } = useTheme();

  const builtInIds = React.useMemo(() => new Set(builtInThemeList.map((t) => t.metadata.id)), []);
  const builtInThemes = availableThemes.filter((t) => builtInIds.has(t.metadata.id));
  const customThemeList = availableThemes.filter((t) => !builtInIds.has(t.metadata.id));

  const handleDeleteCustom = (id: string) => {
    deleteCustomTheme(id);
    if (themeId === id) {
      setTheme("dark-default");
    }
  };

  const handleImport = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    const fileResult = await invoke<{ content: string }>("read_text_file", { path: selected });
    const content = fileResult.content;
    const parsed = JSON.parse(content) as unknown;
    const result = validateTheme(parsed as ThemeInput);
    if (!result.valid) {
      return;
    }

    const theme = parsed as Theme;
    addCustomTheme(theme);
    setTheme(theme.metadata.id);
  };

  return (
    <div className="flex flex-col gap-8">
      <SettingSection title="Built-in Themes">
        <div className="flex flex-col gap-3 py-3">
          <div className="flex justify-end">
            <Button variant="outline" size="xs" onClick={handleImport} className="gap-1">
              <UploadSimple size={14} />
              Import Theme
            </Button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {builtInThemes.map((theme) => (
              <ThemeCard
                key={theme.metadata.id}
                theme={theme}
                active={themeId === theme.metadata.id}
                onSelect={() => setTheme(theme.metadata.id)}
              />
            ))}
          </div>
        </div>
      </SettingSection>

      {customThemeList.length > 0 && (
        <SettingSection title="Custom Themes">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 py-3">
            {customThemeList.map((theme) => (
              <ThemeCard
                key={theme.metadata.id}
                theme={theme}
                active={themeId === theme.metadata.id}
                onSelect={() => setTheme(theme.metadata.id)}
                onDelete={() => handleDeleteCustom(theme.metadata.id)}
              />
            ))}
          </div>
        </SettingSection>
      )}
    </div>
  );
}

interface ThemeCardProps {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

function ThemeCard({ theme, active, onSelect, onDelete }: ThemeCardProps) {
  const [bg, fg, primary, accent] = getThemePreviewColors(theme);

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-lg border transition-colors",
        active ? "border-primary" : "border-border/60 hover:border-border",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="flex flex-col gap-2 p-2 text-left"
      >
        <span
          className="flex h-14 w-full items-center justify-center gap-1.5 rounded-md border border-border/30"
          style={{ backgroundColor: bg }}
        >
          <ColorSwatch color={fg} />
          <ColorSwatch color={primary} />
          <ColorSwatch color={accent} />
        </span>
        <span className="flex min-w-0 items-center justify-between gap-1.5">
          <span className="truncate text-ui-sm text-fg-default">{theme.metadata.name}</span>
          {active && <Check size={14} weight="bold" className="shrink-0 text-primary" />}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${theme.metadata.name}`}
          className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded bg-bg-surface/80 text-fg-muted backdrop-blur-sm transition-colors hover:text-status-error"
        >
          <Trash size={12} />
        </button>
      )}
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="size-3 rounded-sm border border-border/30"
      style={{ backgroundColor: color }}
    />
  );
}
