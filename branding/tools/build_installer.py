"""Rebuilds the Windows installer bitmaps (NSIS/MSI) with the Pragma mark. Requires Pillow and pnpm.

Run from the repo root:  python3 branding/tools/build_installer.py
"""
import os
import subprocess
import tempfile

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "src-tauri", "icons", "installer")
KOHLE = (15, 23, 20)
# name: (canvas size, mark centre, mark size); centres match the previous artwork's layout
LAYOUT = {
    "msi-dialog": ((493, 312), (248, 156), 100),
    "nsis-sidebar": ((164, 314), (83, 157), 84),
    "msi-banner": ((493, 58), (247, 29), 36),
    "nsis-header": ((150, 57), (75, 29), 36),
}

def main():
    with tempfile.TemporaryDirectory() as tmp:
        source = os.path.join(ROOT, "branding", "svg", "pragma-mark-glut.svg")
        subprocess.run(["pnpm", "exec", "tauri", "icon", source, "-o", tmp, "-p", "1024"], cwd=ROOT, check=True,
                       stdout=subprocess.DEVNULL)
        mark = Image.open(os.path.join(tmp, "1024x1024.png")).convert("RGBA")
    # the mark fills 184 of its 256 viewBox units; crop to that so sizes below are the visible mark
    inset = round(1024 * 36 / 256)
    mark = mark.crop((inset, inset, 1024 - inset, 1024 - inset))
    for name, (size, (cx, cy), side) in LAYOUT.items():
        canvas = Image.new("RGBA", size, KOHLE + (255,))
        m = mark.resize((side, side), Image.LANCZOS)
        canvas.alpha_composite(m, (round(cx - side / 2), round(cy - side / 2)))
        canvas.convert("RGB").save(os.path.join(OUT, f"{name}.bmp"))

if __name__ == "__main__":
    main()
