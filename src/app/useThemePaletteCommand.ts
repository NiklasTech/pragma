import { useCommandPaletteStore, type CommandPaletteItem } from "@/shared/stores/commandPalette";
import { useSettingsStore } from "@/shared/stores/settings";
import { applyTheme, builtInThemeList, defaultThemeId, getBuiltInTheme, type Theme } from "@/theme";
import { useRegisterPaletteCommands } from "./useRegisterPaletteCommands";

function availableThemes(): Theme[] {
  return [...builtInThemeList, ...Object.values(useSettingsStore.getState().customThemes)];
}

function findTheme(themes: Theme[], id: string): Theme | undefined {
  return themes.find((theme) => theme.metadata.id === id) ?? getBuiltInTheme(defaultThemeId);
}

function pickTheme(): void {
  const themes = availableThemes();
  const savedId = useSettingsStore.getState().theme;
  const preview = (id: string) => {
    const theme = findTheme(themes, id);
    if (theme) applyTheme(theme);
  };

  useCommandPaletteStore.getState().openPicker({
    placeholder: "Select a color theme (arrow keys preview)",
    emptyText: "No themes found.",
    initialItemId: savedId,
    items: themes.map((theme) => ({
      id: theme.metadata.id,
      label: theme.metadata.name,
      detail: theme.metadata.id === savedId ? "current" : undefined,
    })),
    onHighlight: (item) => preview(item.id),
    onCancel: () => preview(savedId),
    onSelect: (item) => {
      // The provider skips re-applying when the saved theme is chosen again after a preview.
      preview(item.id);
      useSettingsStore.getState().setTheme(item.id);
    },
  });
}

const THEME_COMMANDS: CommandPaletteItem[] = [
  {
    id: "preferences.colorTheme",
    label: "Preferences: Color Theme...",
    category: "Preferences",
    keywords: ["theme", "color", "appearance", "dark", "light"],
    action: pickTheme,
  },
];

export function useThemePaletteCommand(): void {
  useRegisterPaletteCommands(THEME_COMMANDS);
}
