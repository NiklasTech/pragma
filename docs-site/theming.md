# Theming Guide

Pragma ships with built-in themes and supports importing custom themes as JSON. Configure themes in **Settings > Appearance**.

## Color mode

Each theme decides whether Pragma runs in light or dark mode through its `appearance.defaultMode`. Selecting a light theme switches Pragma to light mode, selecting a dark theme to dark mode.

## Built-in themes

| Id              | Name          | Mode  |
| --------------- | ------------- | ----- |
| `dark-default`  | Dark Default  | Dark  |
| `light-default` | Light Default | Light |
| `catppuccin`    | Catppuccin    | Dark  |
| `tokyo-night`   | Tokyo Night   | Dark  |
| `gruvbox`       | Gruvbox       | Dark  |
| `nord`          | Nord          | Dark  |
| `rose-pine`     | Rosé Pine     | Dark  |
| `everforest`    | Everforest    | Dark  |
| `arctic-light`  | Arctic Light  | Light |
| `paper-light`   | Paper Light   | Light |

## Import a custom theme

1. Open **Settings > Appearance**.
2. Select **Import Theme** and choose a JSON file.
3. The theme is validated against the `pragma-theme-v1` format. A valid theme is added to **Custom Themes** and selected immediately. An invalid theme is rejected with a message that lists the first validation errors and their paths.

Custom themes are stored by the settings store and can be removed from the same panel. When a custom theme is deleted while active, Pragma falls back to `dark-default`.

## Theme file format

A theme file has three top-level objects:

```json
{
  "format": "pragma-theme-v1",
  "metadata": {
    "id": "my-theme",
    "name": "My Theme",
    "author": "Your Name",
    "version": "1.0.0"
  },
  "appearance": {
    "defaultMode": "dark",
    "supportedModes": ["dark", "light"]
  },
  "tokens": {}
}
```

- `metadata.id` must contain only lowercase letters, numbers and hyphens.
- `appearance.defaultMode` is `dark`, `light` or `system` and sets the mode Pragma runs in. `system` uses the first entry of `supportedModes`. `supportedModes` is a non-empty array of `dark` and/or `light`.
- `appearance.preferredEditorTheme` optionally names the editor syntax theme to use.

### Token groups

The required token groups are `colors`, `editor` and `terminal`.

| Group      | Contains                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `colors`   | `background`, `foreground`, `accent`, `border`, `status`, `git`, `thread`, `selection`, `scrollbar` |
| `editor`   | `background`, `foreground`, `selection`, `cursor`, `gutter`, `line`, `syntax`                       |
| `terminal` | `background`, `foreground`, `cursor`, `cursorAccent`, `selection`, `ansi`, `ansiBright`             |

`shadows` is optional. Themes only define colors: sizes, fonts and motion are fixed in Pragma. Older theme files that still contain `layout`, `typography` or `motion` are accepted, and these groups are ignored.

Color values accept hex (`#rrggbb`, `#rrggbbaa`), `rgb()`/`rgba()`, `transparent`, or a reference to another token in the form `{colors.foreground.default}`.

The canonical reference is [`src/theme/themes/dark-default.json`](https://github.com/NiklasTech/pragma/blob/main/src/theme/themes/dark-default.json). The TypeScript shape lives in [`src/theme/types.ts`](https://github.com/NiklasTech/pragma/blob/main/src/theme/types.ts) and the import validation in [`src/theme/validateTheme.ts`](https://github.com/NiklasTech/pragma/blob/main/src/theme/validateTheme.ts).

Themes are applied as CSS variables, for example `--bg-root`, `--bg-surface`, `--fg-default` and `--color-accent`. These variables are also available to extension panels rendered in a sandboxed iframe.
