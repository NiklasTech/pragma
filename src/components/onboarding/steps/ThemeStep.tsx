import { useTheme, type ThemeMode } from "@/theme";
import { builtInThemeList } from "@/theme/themes";
import { Check } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/utils";
import { ColorSwatch } from "@/shared/components/ui/color-swatch";
import type { Theme } from "@/theme/types";

function getThemePreviewColors(theme: Theme): [string, string, string, string] {
  const tokens = theme.tokens;
  const bg = tokens.colors?.background?.root ?? tokens.editor?.background ?? "#1a1b26";
  const fg = tokens.colors?.foreground?.default ?? tokens.editor?.foreground ?? "#c0caf5";
  const primary = tokens.colors?.accent?.default ?? "#7aa2f7";
  const accent = tokens.colors?.accent?.subtle ?? "#565f89";
  return [bg, fg, primary, accent];
}

const MODES: { value: ThemeMode; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

export function ThemeStep() {
  const { themeId, mode, setTheme, setMode } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2 text-center">
        <h2 className="text-ui-lg font-semibold text-fg-default">Choose your theme</h2>
        <p className="text-ui-sm text-fg-muted">
          You can always change this later in the settings.
        </p>
      </div>

      <div className="flex justify-center rounded-md border border-border-subtle p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={cn(
              "flex-1 rounded px-4 py-1.5 text-ui-sm font-medium transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              mode === m.value
                ? "bg-bg-surface text-fg-default shadow-sm"
                : "text-fg-muted hover:text-fg-default",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {builtInThemeList.map((theme) => (
          <ThemeCard
            key={theme.metadata.id}
            theme={theme}
            active={themeId === theme.metadata.id}
            onSelect={() => setTheme(theme.metadata.id)}
          />
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
        "flex flex-col gap-2 rounded-md border p-3 text-left transition-all duration-[var(--motion-fast)] ease-[var(--motion-ease)] active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active
          ? "border-transparent ring-2 ring-primary"
          : "border-border-subtle bg-bg-root hover:border-border hover:bg-bg-hover",
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
