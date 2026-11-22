import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { themeMode, useTheme } from "@/theme";
import { builtInThemeList } from "@/theme/themes";
import type { Theme } from "@/theme/types";

type ModeChoice = "dark" | "light" | "system";

const MODES: { value: ModeChoice; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

function previewColors(theme: Theme) {
  const colors = theme.tokens.colors;
  return {
    chrome: colors?.background?.chrome ?? colors?.background?.root ?? "transparent",
    well: colors?.background?.root ?? "transparent",
    line: colors?.foreground?.subtle ?? "transparent",
    accent: colors?.accent?.default ?? "transparent",
  };
}

/** The label the setup rail shows for the current look. */
export function useLookLabel(): string {
  const { theme, followSystemTheme } = useTheme();
  return followSystemTheme ? "System" : theme.metadata.name;
}

/// Dark, light or system, and one of the built-in themes; every choice applies at once.
export function LookBlock() {
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
  const selected = followSystemTheme ? [lightThemeId, darkThemeId] : [themeId];

  const chooseMode = (next: ModeChoice) => {
    if (next === "system") {
      setFollowSystemTheme(true);
      return;
    }
    if (followSystemTheme) setFollowSystemTheme(false);
    setTheme(next === "dark" ? darkThemeId : lightThemeId);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-1 rounded-control bg-bg-input p-[3px] ring-1 ring-border-subtle ring-inset">
        {MODES.map((choice) => (
          <Button
            key={choice.value}
            variant="ghost"
            aria-pressed={mode === choice.value}
            onClick={() => chooseMode(choice.value)}
            className={cn(
              "h-[30px] font-medium",
              mode === choice.value &&
                "bg-bg-sheet text-fg-default shadow-sm ring-1 ring-border ring-inset",
            )}
          >
            {choice.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {builtInThemeList.map((item) => {
          const colors = previewColors(item);
          const active = selected.includes(item.metadata.id);
          return (
            <Button
              key={item.metadata.id}
              variant="ghost"
              aria-pressed={active}
              onClick={() => setTheme(item.metadata.id)}
              className={cn(
                "h-auto flex-col items-stretch justify-start gap-1.5 bg-bg-sheet p-1.5 text-left font-normal whitespace-normal ring-1 ring-inset",
                active
                  ? "shadow-[0_0_0_3px_var(--color-accent-glow)] ring-primary"
                  : "ring-border-subtle",
              )}
            >
              <span
                aria-hidden="true"
                className="flex h-20 flex-col gap-[3px] rounded-[5px] p-1"
                style={{ background: colors.chrome }}
              >
                <span className="flex h-[5px] gap-[3px]">
                  <span className="w-4 rounded-[2px]" style={{ background: colors.line }} />
                  <span className="w-2 rounded-[2px]" style={{ background: colors.accent }} />
                </span>
                <span className="flex flex-1 gap-[3px]">
                  <span className="flex-1 rounded-[3px]" style={{ background: colors.well }} />
                  <span className="flex-[1.4] rounded-[3px]" style={{ background: colors.well }} />
                </span>
              </span>
              <span className="px-0.5 text-ui-xs leading-tight font-medium text-fg-default">
                {item.metadata.name}
              </span>
              <span className="line-clamp-3 px-0.5 font-sans text-ui-2xs leading-snug text-fg-muted">
                {item.metadata.description}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
