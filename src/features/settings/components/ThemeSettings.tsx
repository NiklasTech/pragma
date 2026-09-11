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
        <div className="flex justify-end py-2">
          <Button variant="outline" size="xs" onClick={handleImport} className="gap-1">
            <UploadSimple size={14} />
            Import Theme
          </Button>
        </div>
        {builtInThemes.map((theme) => (
          <ThemeCard
            key={theme.metadata.id}
            theme={theme}
            active={themeId === theme.metadata.id}
            onSelect={() => setTheme(theme.metadata.id)}
          />
        ))}
      </SettingSection>

      {customThemeList.length > 0 && (
        <SettingSection title="Custom Themes">
          {customThemeList.map((theme) => (
            <ThemeCard
              key={theme.metadata.id}
              theme={theme}
              active={themeId === theme.metadata.id}
              onSelect={() => setTheme(theme.metadata.id)}
              onDelete={() => handleDeleteCustom(theme.metadata.id)}
            />
          ))}
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
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 py-2 text-left transition-colors",
        active ? "text-fg-default" : "text-fg-muted hover:text-fg-default",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-ui-sm text-fg-default">{theme.metadata.name}</span>
        <span className="text-ui-xs text-fg-muted">
          {theme.metadata.author ?? "Pragma"} · {theme.appearance.defaultMode}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ColorSwatch color={bg} />
        <ColorSwatch color={fg} />
        <ColorSwatch color={primary} />
        <ColorSwatch color={accent} />
      </div>
      {active && <Check size={14} className="shrink-0 text-primary" />}
      {onDelete && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onDelete();
            }
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center text-fg-muted hover:text-status-error"
        >
          <Trash size={12} />
        </span>
      )}
    </button>
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
