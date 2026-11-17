"use client";

import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { useTheme, builtInThemeList, getBuiltInTheme } from "@/theme";
import { useThemeFolderStore } from "@/theme/themeFolderStore";
import { themeContrastIssues } from "@/theme/accessibility";
import type { Theme } from "@/theme/types";
import { FolderOpen, UploadSimple } from "@phosphor-icons/react";
import { SettingSection } from "./ui/SettingSection";
import { ThemeCard } from "./ThemeCard";
import {
  deleteFolderTheme,
  duplicateTheme,
  exportTheme,
  importTheme,
  openThemesFolder,
} from "./theme-actions";

const PRAGMA_DARK = "dark-default";
const PRAGMA_LIGHT = "light-default";

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
  const findTheme = (id: string) => availableThemes.find((t) => t.metadata.id === id);
  const pragmaDark = getBuiltInTheme(PRAGMA_DARK);
  const pragmaLight = getBuiltInTheme(PRAGMA_LIGHT);
  const highContrastThemes = builtInThemeList.filter(
    (t) => t.metadata.id !== PRAGMA_DARK && t.metadata.id !== PRAGMA_LIGHT,
  );
  const nameOf = (id: string) => findTheme(id)?.metadata.name ?? id;
  const isSelected = (id: string) => !followSystemTheme && id === themeId;
  const customThemeList = availableThemes.filter((t) => !builtInIds.has(t.metadata.id));

  const choose = (id: string) => {
    if (followSystemTheme) setFollowSystemTheme(false);
    setTheme(id);
  };

  const handleDeleteCustom = async (theme: Theme) => {
    const id = theme.metadata.id;
    if (!(await deleteFolderTheme(theme))) deleteCustomTheme(id);
    if (themeId === id) setTheme(PRAGMA_DARK);
  };

  const selectWhenCreated = (id: string | null) => {
    if (id) choose(id);
  };

  const renderCard = (theme: Theme, deletable: boolean) => (
    <ThemeCard
      key={theme.metadata.id}
      theme={theme}
      active={isSelected(theme.metadata.id)}
      onSelect={() => choose(theme.metadata.id)}
      onDuplicate={() => void duplicateTheme(theme, availableThemes).then(selectWhenCreated)}
      onExport={() => void exportTheme(theme)}
      onDelete={deletable ? () => void handleDeleteCustom(theme) : undefined}
      warnings={themeContrastIssues(theme)}
    />
  );

  return (
    <div className="flex flex-col gap-2">
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
        <div className="flex flex-col gap-2 pb-4">
          <div role="group" aria-label="Theme" className="grid grid-cols-3 gap-2.5">
            {pragmaDark && renderCard(pragmaDark, false)}
            {pragmaLight && renderCard(pragmaLight, false)}
            {pragmaDark && pragmaLight && (
              <ThemeCard
                theme={findTheme(darkThemeId) ?? pragmaDark}
                right={findTheme(lightThemeId) ?? pragmaLight}
                label="Follow the system"
                active={followSystemTheme}
                onSelect={() => setFollowSystemTheme(true)}
              />
            )}
          </div>
          <p className="px-1 text-ui-xs text-fg-subtle">
            {followSystemTheme &&
              `Uses ${nameOf(lightThemeId)} in light mode and ${nameOf(darkThemeId)} in dark mode. `}
            Orange stays Pragma orange in every theme: it marks what waits on you and your main
            action.
          </p>
        </div>
        {highContrastThemes.length > 0 && (
          <div className="flex flex-col gap-2 pb-4">
            <h4 className="px-1 text-ui-xs text-fg-subtle">High contrast</h4>
            <div className="grid grid-cols-3 gap-2.5">
              {highContrastThemes.map((theme) => renderCard(theme, false))}
            </div>
          </div>
        )}
      </SettingSection>

      {(customThemeList.length > 0 || brokenFiles.length > 0) && (
        <SettingSection title="Custom Themes">
          <div className="grid grid-cols-3 gap-2.5 py-3">
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
