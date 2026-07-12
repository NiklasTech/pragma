# Pragma UI Redesign

This document captures the design-system decisions and token usage guidelines for the ongoing UI redesign.

## Design Principles

1. **Alive, not noisy** — motion and depth are used to clarify state, never as decoration.
2. **Distinctive but functional** — recognizable as Pragma, not a clone of VS Code or Cursor.
3. **Theme-native** — every visual value must resolve to a token from the active JSON theme.
4. **Dense where it matters** — chrome, sidebars, and toolbars stay compact; settings and chat get slightly more room.
5. **Native polish** — consistent borders, radii, focus rings, hover/active states, and empty states.

## Token Source of Truth

The JSON theme files in `src/theme/themes/*.json` are the source of truth for all visual values. `src/theme/applyTheme.ts` maps those tokens to CSS custom properties on `<html>` at runtime.

`src/globals.css` provides the **fallback defaults** for every CSS variable. These defaults must match the values in the default dark theme (`dark-default.json`) so the UI is correct before `ThemeProvider` applies a theme and when no theme is loaded.

## Token Namespaces

| Namespace                        | Purpose                  | Example                                                              |
| -------------------------------- | ------------------------ | -------------------------------------------------------------------- |
| `--chrome-*`                     | Layout constants         | `--chrome-header-h`, `--chrome-tab-h`, `--chrome-sidebar-expanded-w` |
| `--text-ui-*` / `--leading-ui-*` | UI typography scale      | `--text-ui-base`, `--leading-ui-sm`                                  |
| `--bg-*`                         | Background surfaces      | `--bg-root`, `--bg-surface`, `--bg-elevated`                         |
| `--fg-*`                         | Foreground text colors   | `--fg-default`, `--fg-muted`, `--fg-subtle`                          |
| `--border-*`                     | Border colors            | `--border-default`, `--border-subtle`, `--border-focus`              |
| `--color-accent*`                | Accent colors            | `--color-accent`, `--color-accent-subtle`, `--color-accent-glow`     |
| `--color-status-*`               | Status colors            | `--color-status-success`, `--color-status-success-bg`                |
| `--color-git-*`                  | Git colors               | `--color-git-added`, `--color-git-added-bg`                          |
| `--editor-*` / `--syntax-*`      | Editor chrome and syntax | `--editor-bg`, `--syntax-keyword`                                    |
| `--terminal-*`                   | Terminal colors          | `--terminal-bg`, `--terminal-ansi-red`                               |
| `--motion-*`                     | Durations and easings    | `--motion-base`, `--motion-ease-out`                                 |

## Layout Tokens

All layout dimensions are controlled by `--chrome-*` variables and exposed as Tailwind utilities through `@theme inline` in `src/globals.css`.

| Token                          | Default | Tailwind utility                |
| ------------------------------ | ------- | ------------------------------- |
| `--chrome-header-h`            | `48px`  | `h-header`                      |
| `--chrome-tab-h`               | `34px`  | `h-tab`                         |
| `--chrome-statusbar-h`         | `26px`  | `h-statusbar`                   |
| `--chrome-breadcrumb-h`        | `28px`  | `h-breadcrumb`                  |
| `--chrome-inputbar-h`          | `42px`  | `h-inputbar`                    |
| `--chrome-sidebar-collapsed-w` | `48px`  | `w-[--width-sidebar-collapsed]` |
| `--chrome-sidebar-expanded-w`  | `260px` | `w-[--width-sidebar-expanded]`  |
| `--chrome-sidebar-min-w`       | `180px` | `w-[--width-sidebar-min]`       |
| `--chrome-sidebar-max-w`       | `480px` | `w-[--width-sidebar-max]`       |
| `--chrome-panel-min-h`         | `160px` | `min-h-[--min-height-panel]`    |
| `--chrome-panel-default-h`     | `240px` | —                               |
| `--chrome-row-h`               | `26px`  | —                               |

## Typography Tokens

Use the `text-ui-*` utilities for all UI text. Do not hardcode pixel values like `text-[13px]`.

| Token            | Default | Tailwind utility |
| ---------------- | ------- | ---------------- |
| `--text-ui-2xs`  | `9px`   | `text-ui-2xs`    |
| `--text-ui-xs`   | `11px`  | `text-ui-xs`     |
| `--text-ui-sm`   | `12px`  | `text-ui-sm`     |
| `--text-ui-base` | `13px`  | `text-ui-base`   |
| `--text-ui-md`   | `14px`  | `text-ui-md`     |
| `--text-ui-lg`   | `16px`  | `text-ui-lg`     |

## Motion Tokens

Prefer CSS transitions for interactive state changes. Use the transition tokens directly in CSS:

```css
.my-button {
  transition:
    background-color var(--motion-base) var(--motion-ease),
    transform var(--motion-fast) var(--motion-ease-out);
}
```

Always respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  .my-button {
    transition-duration: 0.01ms;
  }
}
```

| Token                  | Default                             | Use case                        |
| ---------------------- | ----------------------------------- | ------------------------------- |
| `--motion-fast`        | `150ms`                             | Hover, active, focus rings      |
| `--motion-base`        | `200ms`                             | Color/background transitions    |
| `--motion-slow`        | `250ms`                             | Larger state changes            |
| `--motion-layout`      | `300ms`                             | Panel resizes, layout shifts    |
| `--motion-ease`        | `cubic-bezier(0.4, 0, 0.2, 1)`      | Default ease                    |
| `--motion-ease-out`    | `cubic-bezier(0.16, 1, 0.3, 1)`     | Enter/appear                    |
| `--motion-ease-in-out` | `cubic-bezier(0.2, 0, 0, 1)`        | Symmetric transitions           |
| `--motion-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful bounces (use sparingly) |

## Radius Tokens

Use the radius scale consistently. Avoid arbitrary `rounded-[4px]` values.

| Token           | Default  | Use case                     |
| --------------- | -------- | ---------------------------- |
| `--radius-xs`   | `3px`    | Checkboxes, tiny tags        |
| `--radius-sm`   | `5px`    | Buttons, inputs, small cards |
| `--radius-md`   | `8px`    | Cards, dialogs, menus        |
| `--radius-lg`   | `12px`   | Large cards, sheets          |
| `--radius-xl`   | `16px`   | Modals, onboarding           |
| `--radius-pill` | `9999px` | Pills, status indicators     |

## Border Opacity

Use a consistent elevation hierarchy for borders:

- Primary separators: `border-border`
- Secondary/separators: `border-border-subtle`
- For custom alpha blends, prefer `border-[color-mix(in_srgb,var(--color-*)_X%,transparent)]` instead of one-off opacity utilities.

Avoid one-off opacities like `border-border/37`.

## Hardcoded Values to Avoid

Do not introduce new hardcoded values for:

- Colors (use `--bg-*`, `--fg-*`, `--color-*`)
- Spacing (use Tailwind spacing scale or `--layout-padding-*`)
- Typography (use `--text-ui-*`)
- Radii (use `--radius-*`)
- Motion (use `--motion-*`)

Existing hardcoded values are being phased out area by area.

## Icon Library

Use `@phosphor-icons/react` only. Available weights: `thin`, `light`, `regular`, `bold`, `fill`, `duotone`.

```tsx
import { Gear } from "@phosphor-icons/react";

<Gear size={16} weight="bold" />;
```

## Shared Components

Reusable UI primitives that are shared across settings and onboarding live in `src/shared/components/ui/`:

- `ColorSwatch` — a small, token-styled color preview used by theme pickers in both `ThemeSettings` and the onboarding `ThemeStep`.

## shadcn/ui Path

The canonical shadcn/ui components live in `src/shared/components/ui/`. `components.json` points to this path. Do not add new components to the legacy `src/components/ui/` path.
