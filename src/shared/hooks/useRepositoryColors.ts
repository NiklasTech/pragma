import { visibleRepositoryColor } from "@/shared/lib/repositoryColors";
import { useOpenRepositoriesStore } from "@/shared/stores/openRepositories";
import { useSettingsStore } from "@/shared/stores/settings";
import { useOptionalTheme } from "@/theme";
import { ensureContrast, formatColor, parseColor } from "@/theme/color";
import { resolveValue } from "@/theme/tokenResolution";

const MARKER_CONTRAST = 3;

/** A repository's color adjusted to stand out from the theme background, or null to hide it. */
export function useRepositoryColor(path: string | null): string | null {
  const theme = useOptionalTheme()?.theme;
  const byPath = useSettingsStore((s) => s.repositoryColors.byPath);
  const openCount = useOpenRepositoriesStore((s) => s.paths.length);
  if (!path) return null;
  const color = visibleRepositoryColor(byPath, path, openCount);
  const parsed = color ? parseColor(color) : null;
  if (!parsed) return null;
  if (!theme) return color;
  const root = parseColor(resolveValue(theme.tokens.colors.background.root, theme.tokens));
  if (!root) return color;
  return formatColor(ensureContrast(parsed, [root], MARKER_CONTRAST));
}
