"use client";

import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { useTheme, builtInThemeList } from "@/theme";
import { useThemeFolderStore } from "@/theme/themeFolderStore";
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

export function ThemeSettings() {
  const { themeId, setTheme, availableThemes, deleteCustomTheme } = useTheme();
  const folderEntries = useThemeFolderStore((s) => s.entries);
  const brokenFiles = React.useMemo(
    () => Object.values(folderEntries).filter((entry) => !entry.theme && entry.errors.length > 0),
    [folderEntries],
  );

  const builtInIds = React.useMemo(() => new Set(builtInThemeList.map((t) => t.metadata.id)), []);
  const builtInThemes = availableThemes.filter((t) => builtInIds.has(t.metadata.id));
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
      active={themeId === theme.metadata.id}
      onSelect={() => setTheme(theme.metadata.id)}
      onDuplicate={() => void duplicateTheme(theme, availableThemes).then(selectWhenCreated)}
      onExport={() => void exportTheme(theme)}
      onDelete={deletable ? () => void handleDeleteCustom(theme) : undefined}
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
        <div className="flex flex-col gap-3 py-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {builtInThemes.map((theme) => renderCard(theme, false))}
          </div>
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
