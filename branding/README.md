# Pragma brand

The Pragma mark is two lowercase **p** built from editor cells: one is you, the other is your agent, turned 180° around a shared spine. Their outer corners are rounded like arch stones, and the round cell in the middle is the **keystone** that holds both together.

## Files

| Path                                            | Use                                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `svg/pragma-mark-{glut,papier,black,white}.svg` | Symbol, 48 px and up                                                  |
| `svg/pragma-mark-small-{…}.svg`                 | Gap-free symbol for 16–32 px (favicons, title bars, tray)             |
| `svg/pragma-lockup-horizontal-{…}.svg`          | Symbol + wordmark, default lockup                                     |
| `svg/pragma-lockup-stacked-{…}.svg`             | Square-ish spaces (splash, social avatars)                            |
| `svg/pragma-wordmark-{…}.svg`                   | Wordmark alone                                                        |
| `app-icon/pragma-app-icon.svg`, `-small.svg`    | App icon sources (macOS icon grid, 1024 canvas)                       |
| `animated/pragma-intro.svg`                     | Build-in animation, plays once (splash, README)                       |
| `animated/pragma-loader.svg`                    | Looping "thinking" animation                                          |
| `../public/pragma_logo.svg`                     | Adaptive symbol for `<img>` (README header), follows colour scheme    |
| `../public/favicon.svg`                         | Favicon (small cut on a Kohle tile)                                   |
| `../src/shared/components/PragmaMark.tsx`       | In-app symbol; follows the app theme, supports `intro` and `thinking` |

Variants: **glut** is for dark surfaces, **papier** for light surfaces, **black** and **white** are single-colour versions for print, embossing and places where colour is not available.

## Colours

| Name      | Role                        | HEX       | RGB         | CMYK (approx.) | Nearest Pantone (verify) |
| --------- | --------------------------- | --------- | ----------- | -------------- | ------------------------ |
| Kohle     | Dark surface, app icon tile | `#0F1714` | 15 23 20    | 35 0 13 91     | Black 6 C                |
| Creme     | Cells on dark               | `#F3EEE4` | 243 238 228 | 0 2 6 5        | —                        |
| Glut      | Keystone on dark            | `#FF7A3D` | 255 122 61  | 0 52 76 0      | 1575 C                   |
| Papier    | Light surface               | `#F4EFE6` | 244 239 230 | 0 2 6 4        | —                        |
| Tinte     | Cells on light              | `#16181A` | 22 24 26    | 15 8 0 90      | Neutral Black C          |
| Glut tief | Keystone on light           | `#E8531F` | 232 83 31   | 0 64 87 9      | 7579 C                   |

Contrast against the surface: Creme 15.8:1, Glut 7.0:1 (on Kohle); Tinte 15.5:1, Glut tief 3.2:1 (on Papier). The keystone is also set apart by its shape, so the mark still reads in one colour.

CMYK values are straight conversions; use a proper ICC conversion for print. Pantone matches are the nearest guesses and must be checked against a swatch book.

In the app, the keystone uses the theme tokens `--color-brand-key` (light) and `--color-brand-key-bright` (dark).

## Usage

- **Clear space:** keep at least one cell width (the width of one square) free around the symbol or lockup.
- **Minimum size:** full symbol 48 px, small cut 16 px, horizontal lockup 120 px wide.
- **Backgrounds:** glut on Kohle or other dark surfaces, papier on Papier, white or light surfaces. On photos or busy backgrounds, use the app icon tile.
- **Keystone:** always the accent colour, or the same colour as the cells in single-colour use. Never recolour individual cells.
- **Do not** stretch, rotate (except the loader animation), outline, add shadows or gradients, rearrange cells, or set the wordmark in a font. The wordmark is constructed geometry, so no font licence is involved.

## Motion

- **Intro:** cells pop in from the outside towards the centre (130 ms apart, 450 ms each), then the keystone locks in (600 ms, slight overshoot). Used once, e.g. on the welcome screen.
- **Thinking:** the mark turns 180° every 1.6 s and lands on itself thanks to its point symmetry; the keystone pulses. Used while an agent works.
- Both respect `prefers-reduced-motion`.

## Regenerating

The SVGs, the app icon sources and `src/shared/lib/pragma-mark-paths.ts` are generated from geometry:

```bash
pip install skia-pathops pillow
python3 branding/tools/build_logo.py
pnpm exec vp fmt src/shared/lib/pragma-mark-paths.ts
pnpm run generate:icons                   # src-tauri/icons (small cut up to 44 px, full grid above)
python3 branding/tools/build_installer.py # Windows installer bitmaps
```

## Status

A professional trademark search has not been done yet. Run one (trademark databases plus a reverse image search) before registering or widely promoting the mark.
