"use client";

import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { Switch } from "@/shared/components/ui/switch";
import { useTheme, builtInThemeList, themeMode } from "@/theme";
import { useThemeFolderStore } from "@/theme/themeFolderStore";
import { themeContrastIssues } from "@/theme/accessibility";
import type { Theme } from "@/theme/types";
import { FolderOpen, UploadSimple } from "@phosphor-icons/react";
import { AccentColorSetting } from "./AccentColorSetting";
import { SettingRow } from "./ui/SettingRow";
import { SettingSection } from "./ui/SettingSection";
import { ThemeCard } from "./ThemeCard";
import {
  deleteFolderTheme,
  duplicateTheme,
  exportTheme,
  importTheme,
  openThemesFolder,
} from "./theme-actions";

export function ThemeSettings() {
  const {
    themeId,
    setTheme,
    availableThemes,
    deleteCustomTheme,
    followSystemTheme,
    lightThemeId,
    darkThemeId,
    setFollowSystemTheme,
  } = useTheme();
  const folderEntries = useThemeFolderStore((s) => s.entries);
  const brokenFiles = React.useMemo(
    () => Object.values(folderEntries).filter((entry) => !entry.theme && entry.errors.length > 0),
    [folderEntries],
  );

  const builtInIds = React.useMemo(() => new Set(builtInThemeList.map((t) => t.metadata.id)), []);
  const builtInThemes = availableThemes.filter((t) => builtInIds.has(t.metadata.id));
  const darkThemes = builtInThemes.filter((t) => themeMode(t) === "dark");
  const lightThemes = builtInThemes.filter((t) => themeMode(t) === "light");
  const nameOf = (id: string) =>
    availableThemes.find((t) => t.metadata.id === id)?.metadata.name ?? id;
  const isSelected = (id: string) =>
    followSystemTheme ? id === lightThemeId || id === darkThemeId : id === themeId;
  const customThemeList = availableThemes.filter((t) => !builtInIds.has(t.metadata.id));

  const handleDeleteCustom = async (theme: Theme) => {
    const id = theme.metadata.id;
    if (!(await deleteFolderTheme(theme))) deleteCustomTheme(id);
    if (themeId === id) setTheme("dark-default");
  };

  const selectWhenCreated = (id: string | null) => {
    if (id) setTheme(id);
  };

  const renderCard = (theme: Theme, deletable: boolean) => (
    <ThemeCard
      key={theme.metadata.id}
      theme={theme}
      active={isSelected(theme.metadata.id)}
      onSelect={() => setTheme(theme.metadata.id)}
      onDuplicate={() => void duplicateTheme(theme, availableThemes).then(selectWhenCreated)}
      onExport={() => void exportTheme(theme)}
      onDelete={deletable ? () => void handleDeleteCustom(theme) : undefined}
      warnings={themeContrastIssues(theme)}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <SettingSection
        title="Theme"
        action={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="xs" onClick={openThemesFolder} className="gap-1">
              <FolderOpen size={12} />
              Open Themes Folder
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => void importTheme(availableThemes).then(selectWhenCreated)}
              className="gap-1"
            >
              <UploadSimple size={12} />
              Import Theme
            </Button>
          </div>
        }
      >
        <AccentColorSetting />
        <SettingRow
          label="Follow system appearance"
          description={
            followSystemTheme
              ? `Uses ${nameOf(lightThemeId)} in light mode and ${nameOf(darkThemeId)} in dark mode. Select a theme to use it for its mode.`
              : "Switch between a light and a dark theme when the system appearance changes."
          }
          control={<Switch checked={followSystemTheme} onCheckedChange={setFollowSystemTheme} />}
        />
        <div className="flex flex-col gap-4 pb-4">
          {[
            { label: "Dark", themes: darkThemes },
            { label: "Light", themes: lightThemes },
          ].map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <h4 className="px-1 text-ui-xs text-fg-subtle">{group.label}</h4>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                {group.themes.map((theme) => renderCard(theme, false))}
              </div>
            </div>
          ))}
        </div>
      </SettingSection>

      {(customThemeList.length > 0 || brokenFiles.length > 0) && (
        <SettingSection title="Custom Themes">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 py-3">
            {customThemeList.map((theme) => renderCard(theme, true))}
          </div>
          {brokenFiles.map((entry) => (
            <p key={entry.fileName} className="px-1 text-ui-xs text-status-error">
              {entry.fileName}: {entry.errors[0]}
            </p>
          ))}
        </SettingSection>
      )}
    </div>
  );
}
