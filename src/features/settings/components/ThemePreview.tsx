import type { Theme } from "@/theme/types";

function colorsOf(theme: Theme) {
  const { background, foreground, accent } = theme.tokens.colors;
  return {
    chrome: background.chrome ?? background.root,
    well: background.root,
    ink: foreground.default,
    accent: accent.default,
  };
}

/// A small window of the theme: chrome, a tab, the accent and two panes. `right` splits it in half.
export function ThemePreview({ theme, right }: { theme: Theme; right?: Theme }) {
  const left = colorsOf(theme);
  const other = right ? colorsOf(right) : left;
  return (
    <span
      aria-hidden="true"
      className="flex h-[92px] w-full flex-col gap-1 overflow-hidden rounded-lg p-1.5"
      style={{
        background: right
          ? `linear-gradient(90deg, ${left.chrome} 50%, ${other.chrome} 50%)`
          : left.chrome,
      }}
    >
      <span className="flex h-2 gap-[3px]">
        <span className="w-[30px] rounded-[3px] opacity-15" style={{ background: left.ink }} />
        <span className="ml-auto w-[18px] rounded-[3px]" style={{ background: other.accent }} />
      </span>
      <span className="flex flex-1 gap-1">
        <span className="flex-1 rounded" style={{ background: left.well }} />
        <span className="flex-1 rounded" style={{ background: other.well }} />
      </span>
    </span>
  );
}
