"""Builds every Pragma logo asset from geometry. Requires: pip install skia-pathops.

Run from the repo root:  python3 branding/tools/build_logo.py
"""
import math
import os
import pathops

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BR = os.path.join(ROOT, "branding")

# Brand palette: "Glut" for dark surfaces, "Papier & Tinte" for light ones.
KOHLE, CREME, GLUT = "#0F1714", "#F3EEE4", "#FF7A3D"
PAPIER, TINTE, GLUT_TIEF = "#F4EFE6", "#16181A", "#E8531F"

# ---------- primitives ----------
def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s

def arc(p, cx, cy, r, a0, a1):
    n = max(1, math.ceil(abs(a1 - a0) / 90))
    step = (a1 - a0) / n
    for i in range(n):
        t0, t1 = math.radians(a0 + i * step), math.radians(a0 + (i + 1) * step)
        k = 4 / 3 * math.tan((t1 - t0) / 4)
        x0, y0 = cx + r * math.cos(t0), cy + r * math.sin(t0)
        x3, y3 = cx + r * math.cos(t1), cy + r * math.sin(t1)
        p.cubicTo(x0 - k * r * math.sin(t0), y0 + k * r * math.cos(t0),
                  x3 + k * r * math.sin(t1), y3 - k * r * math.cos(t1), x3, y3)

def circle(cx, cy, r):
    p = pathops.Path(); p.moveTo(cx + r, cy); arc(p, cx, cy, r, 0, 360); p.close(); return p

def rect(x0, y0, x1, y1):
    p = pathops.Path(); p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.close(); return p

def rrect(x0, y0, x1, y1, tl, tr, br, bl):
    p = pathops.Path(); p.moveTo(x0 + tl, y0); p.lineTo(x1 - tr, y0); arc(p, x1 - tr, y0 + tr, tr, -90, 0)
    p.lineTo(x1, y1 - br); arc(p, x1 - br, y1 - br, br, 0, 90); p.lineTo(x0 + bl, y1)
    arc(p, x0 + bl, y1 - bl, bl, 90, 180); p.lineTo(x0, y0 + tl); arc(p, x0 + tl, y0 + tl, tl, 180, 270)
    p.close(); return p

def band(cx, cy, ri, ro, a0, a1):
    p = pathops.Path(); p.moveTo(cx + ro * math.cos(math.radians(a0)), cy + ro * math.sin(math.radians(a0)))
    arc(p, cx, cy, ro, a0, a1)
    p.lineTo(cx + ri * math.cos(math.radians(a1)), cy + ri * math.sin(math.radians(a1)))
    arc(p, cx, cy, ri, a1, a0); p.close(); return p

def op(a, b, kind): return pathops.op(a, b, kind)
def union(*ps):
    out = ps[0]
    for p in ps[1:]: out = op(out, p, pathops.PathOp.UNION)
    return out
def diff(a, b): return op(a, b, pathops.PathOp.DIFFERENCE)
def ring(cx, cy, ro, ri): return diff(circle(cx, cy, ro), circle(cx, cy, ri))

def d_of(p, dx=0, dy=0, k=1):
    out = []
    for verb, pts in p.segments:
        c = " ".join(f"{f(x * k + dx)} {f(y * k + dy)}" for x, y in pts)
        out.append({"moveTo": "M", "lineTo": "L", "curveTo": "C", "qCurveTo": "Q", "closePath": "Z"}[verb] + c)
    return "".join(out)

# ---------- the mark: Bogen-Raster ----------
PITCH, CELL, R_CELL, R_ARCH, GAP = 38, 32, 7, 26, 6
X0 = (256 - (4 * PITCH + CELL)) / 2
CELLS = [(2, 0), (3, 0), (4, 0), (2, 1), (4, 1), (0, 2), (1, 2), (3, 2), (4, 2), (0, 3), (2, 3), (0, 4), (1, 4), (2, 4)]
ARCH = {(4, 0): (R_CELL, R_ARCH, R_CELL, R_CELL), (4, 2): (R_CELL, R_CELL, R_ARCH, R_CELL),
        (0, 4): (R_CELL, R_CELL, R_CELL, R_ARCH), (0, 2): (R_ARCH, R_CELL, R_CELL, R_CELL)}
KEY_R = CELL / 2 + 1.5  # optical overshoot: a circle reads smaller than a square of equal width

def mark_cells():
    """[(col, row, path)] for the fourteen cells; the keystone sits at (2, 2)."""
    out = []
    for c, r in CELLS:
        x, y = X0 + c * PITCH, X0 + r * PITCH
        out.append((c, r, rrect(x, y, x + CELL, y + CELL, *ARCH.get((c, r), (R_CELL,) * 4))))
    return out

def mark_key():
    return circle(128, 128, KEY_R)

def mark_small():
    """Gap-free cut for 16-32 px: two solid rings, the keystone set off by one gap."""
    ext = X0 + 4 * PITCH + CELL
    r1 = rrect(X0 + 2 * PITCH, X0, ext, X0 + 2 * PITCH + CELL, R_CELL, R_ARCH, R_ARCH, R_CELL)
    hx, hy = X0 + 3 * PITCH - GAP, X0 + PITCH - GAP
    r1 = diff(r1, rrect(hx, hy, hx + CELL + 2 * GAP, hy + CELL + 2 * GAP, 4, 4, 4, 4))
    r2 = rrect(256 - ext, 256 - (X0 + 2 * PITCH + CELL), 256 - (X0 + 2 * PITCH), 256 - X0, R_ARCH, R_CELL, R_CELL, R_ARCH)
    hx2, hy2 = 256 - (hx + CELL + 2 * GAP), 256 - (hy + CELL + 2 * GAP)
    r2 = diff(r2, rrect(hx2, hy2, hx2 + CELL + 2 * GAP, hy2 + CELL + 2 * GAP, 4, 4, 4, 4))
    rings = diff(union(r1, r2), circle(128, 128, KEY_R + GAP))
    return rings, mark_key()

# ---------- wordmark: geometric lowercase "pragma" ----------
def wordmark():
    X, s, gap, desc = 100, 20, 16, 42
    R, ri = X / 2, X / 2 - s
    ps, x = [], 0
    ps += [rect(x, 0, x + s, X + desc), ring(x + R, R, R, ri)]; x += X + gap
    ps += [rect(x, 0, x + s, X), band(x + R, R, ri, R, 180, 300)]; x += R + 0.36 * R + gap
    ps += [ring(x + R, R, R, ri), rect(x + X - s, 0, x + X, X)]; x += X + gap
    ps += [ring(x + R, R, R, ri), rect(x + X - s, 0, x + X, X), band(x + R, X + desc - R, ri, R, 0, 155)]; x += X + gap
    ro = 1.5 * X / 4 + s / 4
    ps += [rect(x, 0, x + s, X), band(x + ro, ro, ro - s, ro, 180, 360), rect(x + 2 * ro - s, ro, x + 2 * ro, X),
           band(x + 3 * ro - s, ro, ro - s, ro, 180, 360), rect(x + 4 * ro - 2 * s, ro, x + 4 * ro - s, X)]
    x += 4 * ro - s + gap
    ps += [ring(x + R, R, R, ri), rect(x + X - s, 0, x + X, X)]; x += X
    return union(*ps), x, X, desc

# ---------- svg writers ----------
def svg(w, h, body, title, extra=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" role="img">'
            f'<title>{title}</title>{extra}{body}</svg>\n')

def mark_body(cells_fill, key_fill, dx=0, dy=0, k=1, small=False):
    if small:
        rings, key = mark_small()
        return f'<path fill="{cells_fill}" d="{d_of(rings, dx, dy, k)}"/><path fill="{key_fill}" d="{d_of(key, dx, dy, k)}"/>'
    cells = union(*[p for _, _, p in mark_cells()])
    return f'<path fill="{cells_fill}" d="{d_of(cells, dx, dy, k)}"/><path fill="{key_fill}" d="{d_of(mark_key(), dx, dy, k)}"/>'

def write(rel, text):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write(text)

VARIANTS = {"glut": (CREME, GLUT), "papier": (TINTE, GLUT_TIEF), "black": ("#000000", "#000000"), "white": ("#FFFFFF", "#FFFFFF")}

def lockup_h(cells, key, wm_fill):
    wm, ww, X, _ = wordmark()
    k, pad, left, right = 0.8, 24, X0, 256 - X0
    shift = -(left - pad)
    wx = right + 44 + shift
    body = mark_body(cells, key, dx=shift) + f'<path fill="{wm_fill}" d="{d_of(wm, wx, 128 - X * k / 2 + 6, k)}"/>'
    return wx + ww * k + pad, 256, body

def lockup_v(cells, key, wm_fill):
    wm, ww, X, desc = wordmark()
    k, top = 0.42, 256 - X0 + 30
    w = max(256, ww * k + 2 * X0)
    body = mark_body(cells, key, dx=(w - 256) / 2) + f'<path fill="{wm_fill}" d="{d_of(wm, (w - ww * k) / 2, top, k)}"/>'
    return w, top + (X + desc) * k + X0, body

def app_icon(small=False):
    """1024 canvas on the macOS icon grid (824 tile, 100 inset)."""
    s = (600 if small else 500) / (4 * PITCH + CELL)
    body = (f'<rect x="100" y="100" width="824" height="824" rx="185" fill="{KOHLE}"/>'
            + mark_body(CREME, GLUT, dx=512 - 128 * s, dy=512 - 128 * s, k=s, small=small))
    return svg(1024, 1024, body, "Pragma app icon")

ANIM_CSS = """<style>
.c,.k{transform-box:fill-box;transform-origin:center}
.c{fill:%(tinte)s}.k{fill:%(glut_tief)s}
@media (prefers-color-scheme:dark){.c{fill:%(creme)s}.k{fill:%(glut)s}}
%(rules)s
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>"""

def animated(kind):
    cells = "".join(
        f'<path class="c" style="animation-delay:{(4 - abs(c - 2) - abs(r - 2)) * 130}ms" d="{d_of(p)}"/>' for c, r, p in mark_cells())
    key = f'<path class="k" d="{d_of(mark_key())}"/>'
    if kind == "intro":
        rules = (".c{animation:pop .45s cubic-bezier(.3,1.5,.5,1) both}"
                 ".k{animation:lock .6s cubic-bezier(.3,1.6,.5,1) .75s both}"
                 "@keyframes pop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}"
                 "@keyframes lock{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}")
        body = cells + key
    else:
        rules = (".spin{transform-origin:128px 128px;animation:half 1.6s cubic-bezier(.7,0,.3,1) infinite}"
                 ".k{animation:pulse 1.6s ease-in-out infinite}"
                 "@keyframes half{0%{transform:rotate(0)}75%,100%{transform:rotate(180deg)}}"
                 "@keyframes pulse{0%,100%{transform:scale(1)}40%{transform:scale(.72)}}")
        body = f'<g class="spin">{cells.replace(" style=", " data-d=")}{key}</g>'
    css = ANIM_CSS % {"tinte": TINTE, "glut_tief": GLUT_TIEF, "creme": CREME, "glut": GLUT, "rules": rules}
    return svg(256, 256, body, f"Pragma {kind}", css)

def ts_paths():
    cells = ",\n".join(
        f'  {{ d: "{d_of(p)}", step: {4 - abs(c - 2) - abs(r - 2)} }}' for c, r, p in mark_cells())
    rings, key = mark_small()
    return ("// Generated by branding/tools/build_logo.py. Do not edit by hand.\n\n"
            "export interface PragmaMarkCell {\n  d: string;\n  step: number;\n}\n\n"
            f"export const PRAGMA_MARK_CELLS: readonly PragmaMarkCell[] = [\n{cells},\n];\n\n"
            f'export const PRAGMA_MARK_KEY = "{d_of(key)}";\n\n'
            f'export const PRAGMA_MARK_SMALL_RINGS = "{d_of(rings)}";\n')

def main():
    for name, (cells, key) in VARIANTS.items():
        write(f"branding/svg/pragma-mark-{name}.svg", svg(256, 256, mark_body(cells, key), "Pragma"))
        write(f"branding/svg/pragma-mark-small-{name}.svg", svg(256, 256, mark_body(cells, key, small=True), "Pragma"))
        w, h, body = lockup_h(cells, key, cells)
        write(f"branding/svg/pragma-lockup-horizontal-{name}.svg", svg(w, h, body, "Pragma"))
        w, h, body = lockup_v(cells, key, cells)
        write(f"branding/svg/pragma-lockup-stacked-{name}.svg", svg(w, h, body, "Pragma"))
    wm, ww, X, desc = wordmark()
    for name, fill in (("glut", CREME), ("papier", TINTE), ("black", "#000000"), ("white", "#FFFFFF")):
        write(f"branding/svg/pragma-wordmark-{name}.svg", svg(ww + 40, X + desc + 40, f'<path fill="{fill}" d="{d_of(wm, 20, 20)}"/>', "pragma"))
    write("branding/app-icon/pragma-app-icon.svg", app_icon())
    write("branding/app-icon/pragma-app-icon-small.svg", app_icon(small=True))
    write("branding/animated/pragma-intro.svg", animated("intro"))
    write("branding/animated/pragma-loader.svg", animated("loader"))
    # adaptive mark for <img> use (README, docs): follows the viewer's colour scheme
    adaptive = (f"<style>.c{{fill:{TINTE}}}.k{{fill:{GLUT_TIEF}}}"
                f"@media (prefers-color-scheme:dark){{.c{{fill:{CREME}}}.k{{fill:{GLUT}}}}}</style>")
    cells = union(*[p for _, _, p in mark_cells()])
    write("public/pragma_logo.svg", svg(256, 256, f'<path class="c" d="{d_of(cells)}"/><path class="k" d="{d_of(mark_key())}"/>', "Pragma", adaptive))
    s = 0.86
    write("public/favicon.svg", svg(256, 256, f'<rect width="256" height="256" rx="56" fill="{KOHLE}"/>'
                                    + mark_body(CREME, GLUT, dx=128 - 128 * s, dy=128 - 128 * s, k=s, small=True), "Pragma"))
    write("src/shared/lib/pragma-mark-paths.ts", ts_paths())

if __name__ == "__main__":
    main()
