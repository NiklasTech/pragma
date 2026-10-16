import { themeMode, useTheme } from "@/theme";
import { builtInThemeList } from "@/theme/themes";
import { Check } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import type { Theme } from "@/theme/types";

function getThemePreviewColors(theme: Theme): [string, string, string, string] {
  const tokens = theme.tokens;
  const bg = tokens.colors?.background?.root ?? tokens.editor?.background ?? "#1a1b26";
  const fg = tokens.colors?.foreground?.default ?? tokens.editor?.foreground ?? "#c0caf5";
  const primary = tokens.colors?.accent?.default ?? "#7aa2f7";
  const accent = tokens.colors?.accent?.subtle ?? "#565f89";
  return [bg, fg, primary, accent];
}

type ModeChoice = "dark" | "light" | "system";

const MODES: { value: ModeChoice; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

const DARK_THEMES = builtInThemeList.filter((theme) => themeMode(theme) === "dark");
const LIGHT_THEMES = builtInThemeList.filter((theme) => themeMode(theme) === "light");

export function ThemeStep() {
  const {
    theme,
    themeId,
    setTheme,
    followSystemTheme,
    lightThemeId,
    darkThemeId,
    setFollowSystemTheme,
  } = useTheme();
  const mode: ModeChoice = followSystemTheme ? "system" : themeMode(theme);

  const chooseMode = (next: ModeChoice) => {
    if (next === "system") {
      setFollowSystemTheme(true);
      return;
    }
    if (followSystemTheme) setFollowSystemTheme(false);
    setTheme(next === "dark" ? darkThemeId : lightThemeId);
  };

  const groups =
    mode === "system"
      ? [
          { label: "Light", themes: LIGHT_THEMES, selected: lightThemeId },
          { label: "Dark", themes: DARK_THEMES, selected: darkThemeId },
        ]
      : [{ label: null, themes: mode === "dark" ? DARK_THEMES : LIGHT_THEMES, selected: themeId }];

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-fg-default">Choose your theme</h2>
        <p className="text-ui-sm text-fg-muted">
          {mode === "system"
            ? "Pick a light and a dark theme. Pragma switches with the system appearance."
            : "You can always change this later in the settings."}
        </p>
      </div>

      <div className="flex justify-center rounded-md border border-border/30 p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => chooseMode(m.value)}
            aria-pressed={mode === m.value}
            className={cn(
              "flex-1 rounded px-4 py-1.5 text-ui-sm font-medium transition-colors",
              mode === m.value
                ? "bg-bg-surface text-fg-default shadow-sm"
                : "text-fg-muted hover:text-fg-default",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex max-h-[360px] flex-col gap-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label ?? "themes"} className="flex flex-col gap-2">
            {group.label && <h3 className="text-ui-xs text-fg-subtle">{group.label}</h3>}
            <div className="grid grid-cols-3 gap-3">
              {group.themes.map((t) => (
                <ThemeCard
                  key={t.metadata.id}
                  theme={t}
                  active={group.selected === t.metadata.id}
                  onSelect={() => setTheme(t.metadata.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ThemeCardProps {
  theme: Theme;
  active: boolean;
  onSelect: () => void;
}

function ThemeCard({ theme, active, onSelect }: ThemeCardProps) {
  const [bg, fg, primary, accent] = getThemePreviewColors(theme);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 rounded-md border p-3 text-left transition-colors",
        active
          ? "border-transparent ring-2 ring-primary"
          : "border-border/30 bg-bg-root hover:border-border hover:bg-bg-hover",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-ui-sm font-medium text-fg-default">
          {theme.metadata.name}
        </span>
        {active && <Check size={14} className="shrink-0 text-primary" />}
      </div>
      <div className="flex items-center gap-1.5">
        <ColorSwatch color={bg} />
        <ColorSwatch color={fg} />
        <ColorSwatch color={primary} />
        <ColorSwatch color={accent} />
      </div>
    </button>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="size-4 rounded-full border border-border/30"
      style={{ backgroundColor: color }}
    />
  );
}
