"use client";

import * as React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useTheme, type ThemeMode } from "@/theme";
import { saveCustomTheme, deleteCustomTheme, loadCustomThemes } from "@/theme/customThemes";
import { validateTheme } from "@/theme/validateTheme";
import type { Theme, ThemeInput } from "@/theme/types";
import { Moon, Sun, Desktop, Check, Trash, UploadSimple } from "@phosphor-icons/react";

const MODE_ICONS: Record<ThemeMode, React.ElementType> = {
  dark: Moon,
  light: Sun,
  system: Desktop,
};

export function ThemeSettings() {
  const { themeId, mode, setTheme, setMode, availableThemes } = useTheme();
  const [customThemes, setCustomThemes] = React.useState<Record<string, Theme>>(() =>
    loadCustomThemes(),
  );

  const builtInThemes = availableThemes.filter((t) => !customThemes[t.metadata.id]);
  const customThemeList = Object.values(customThemes);

  const refreshCustomThemes = () => {
    setCustomThemes(loadCustomThemes());
  };

  const handleDeleteCustom = (id: string) => {
    deleteCustomTheme(id);
    if (themeId === id) {
      setTheme("dark-default");
    }
    refreshCustomThemes();
  };

  const handleImport = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    const content = await readTextFile(selected);
    const parsed = JSON.parse(content) as unknown;
    const result = validateTheme(parsed as ThemeInput);
    if (!result.valid) {
      console.error("[Theme Import]", result.errors);
      return;
    }

    const theme = parsed as Theme;
    saveCustomTheme(theme);
    refreshCustomThemes();
    setTheme(theme.metadata.id);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Built-in Themes</CardTitle>
          <Button variant="outline" size="xs" onClick={handleImport} className="gap-1">
            <UploadSimple size={14} />
            Import Theme
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            {builtInThemes.map((theme) => (
              <ThemeRow
                key={theme.metadata.id}
                theme={theme}
                active={themeId === theme.metadata.id}
                onSelect={() => setTheme(theme.metadata.id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {customThemeList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custom Themes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2">
              {customThemeList.map((theme) => (
                <ThemeRow
                  key={theme.metadata.id}
                  theme={theme}
                  active={themeId === theme.metadata.id}
                  onSelect={() => setTheme(theme.metadata.id)}
                  onDelete={() => handleDeleteCustom(theme.metadata.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ThemeRowProps {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

function ThemeRow({ theme, active, onSelect, onDelete }: ThemeRowProps) {
  const ModeIcon = MODE_ICONS[theme.appearance.defaultMode];

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 transition-colors ${
        active
          ? "border-primary/50 bg-accent-subtle"
          : "border-border/60 bg-bg-root hover:border-border hover:bg-bg-hover"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-ui-sm font-medium text-fg-default">{theme.metadata.name}</span>
        <span className="text-ui-xs text-fg-muted">
          {theme.metadata.author ?? "Pragma"} · {theme.appearance.defaultMode}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <ModeIcon size={14} className="text-fg-subtle" />
        {active ? (
          <Check size={14} className="text-primary" />
        ) : (
          <Button variant="ghost" size="icon-xs" onClick={onSelect} title="Select theme">
            <Check size={14} />
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onDelete}
            title="Delete custom theme"
            className="text-fg-muted hover:text-status-error"
          >
            <Trash size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}
