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

## Custom themes

A custom theme takes a few lines. There are three ways to write one:

- **Extend a theme**: name an existing theme in `extends` and set only the tokens you change.
- **Base colors**: give a short `palette` and let Pragma derive every other color.
- **Full theme**: set every token yourself (see [Theme file format](#theme-file-format)).

### Extend a theme

```json
{
  "format": "pragma-theme-v1",
  "metadata": { "id": "nord-pink", "name": "Nord Pink" },
  "extends": "nord",
  "tokens": { "colors": { "accent": { "default": "#ff79c6" } } }
}
```

Missing tokens come from the base theme, including its light or dark mode. References like `{colors.accent.default}` keep working, and the accent-tinted tokens (`accent.subtle`, `accent.glow`, `border.focus`, `selection` and `background.active`) follow a new accent unless you set them too. A theme can extend a built-in theme or another custom theme.

### Base colors

```json
{
  "format": "pragma-theme-v1",
  "metadata": { "id": "dusk", "name": "Dusk" },
  "palette": { "background": "#1e1e2e", "foreground": "#cdd6f4", "accent": "#f5c2e7" }
}
```

`background`, `foreground` and `accent` are required; `success`, `warning`, `error` and `info` are optional. Palette colors are hex or `rgb()` values. Pragma derives surfaces, borders, hover states, selection, scrollbar, git, editor syntax and terminal colors with fixed contrast rules: text reaches at least 4.5:1 against the background, and the mode follows the background's brightness. Tokens you set in `tokens` win over derived ones. `palette` cannot be combined with `extends`.

## Themes folder

Custom themes are `.json` files in the `themes` folder of Pragma's application data directory. Select **Open Themes Folder** in **Settings > Appearance** to open it. Pragma lists every file there under **Custom Themes** and reloads a theme as soon as you save its file. If a file has errors, Pragma shows them and keeps the last valid version of the theme active.

- **Import Theme** validates a JSON file and copies it into the themes folder.
- **Duplicate** (in a theme card's menu) creates a file that extends the theme, ready to edit.
- **Export** saves a theme as a JSON file. Themes from the folder export as written; other themes export in full.
- **Delete** removes a custom theme. When a custom theme is deleted while active, Pragma falls back to `dark-default`.

Theme ids must be unique and cannot reuse the id of a built-in theme. Error messages list the first problems with their path, for example `tokens.colors.accent.default: invalid color value "pink"`.

## Theme file format

A full theme file has three top-level objects. Themes that use `extends` or `palette` may leave out `appearance` and any tokens they do not change.

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

The required token groups of a full theme are `colors`, `editor` and `terminal`.

| Group      | Contains                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `colors`   | `background`, `foreground`, `accent`, `border`, `status`, `git`, `thread`, `selection`, `scrollbar` |
| `editor`   | `background`, `foreground`, `selection`, `cursor`, `gutter`, `line`, `syntax`                       |
| `terminal` | `background`, `foreground`, `cursor`, `cursorAccent`, `selection`, `ansi`, `ansiBright`             |

`shadows` is optional. Themes only define colors: sizes, fonts and motion are fixed in Pragma. Older theme files that still contain `layout`, `typography` or `motion` are accepted, and these groups are ignored.

Color values accept hex (`#rrggbb`, `#rrggbbaa`), `rgb()`/`rgba()`, `transparent`, or a reference to another token in the form `{colors.foreground.default}`.

The canonical reference is [`src/theme/themes/dark-default.json`](https://github.com/NiklasTech/pragma/blob/main/src/theme/themes/dark-default.json). The TypeScript shape lives in [`src/theme/types.ts`](https://github.com/NiklasTech/pragma/blob/main/src/theme/types.ts) and the import validation in [`src/theme/validateTheme.ts`](https://github.com/NiklasTech/pragma/blob/main/src/theme/validateTheme.ts).

Themes are applied as CSS variables, for example `--bg-root`, `--bg-surface`, `--fg-default` and `--color-accent`. These variables are also available to extension panels rendered in a sandboxed iframe.
