import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const iconsDir = join(root, "src-tauri", "icons");
const fullSource = join(root, "branding", "app-icon", "pragma-app-icon.svg");
// Gap-free cut of the mark: the full cell grid blurs below 48 px.
const smallSource = join(root, "branding", "app-icon", "pragma-app-icon-small.svg");

const SMALL_SIZES = [16, 24, 30, 32, 44, 64];
const FULL_SIZES = [48, 50, 64, 71, 89, 107, 128, 142, 150, 256, 284, 310, 512, 1024];

const tmp = mkdtempSync(join(tmpdir(), "pragma-icons-"));
const smallDir = join(tmp, "small");
const fullDir = join(tmp, "full");

function render(source, sizes, outDir) {
  const result = spawnSync(
    "pnpm",
    ["exec", "tauri", "icon", source, "-o", outDir, "-p", sizes.join(",")],
    { cwd: root, stdio: "inherit", shell: true },
  );
  if (result.status !== 0) {
    rmSync(tmp, { recursive: true, force: true });
    process.exit(result.status ?? 1);
  }
}

const pngPath = (size, dir = size < 48 ? smallDir : fullDir) => join(dir, `${size}x${size}.png`);
const png = (size, dir) => readFileSync(pngPath(size, dir));

function buildIco(sizes) {
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  const images = sizes.map((size) => png(size));
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  return Buffer.concat([header, ...images]);
}

function buildIcns(entries) {
  const chunks = entries.map(([type, size, dir]) => {
    const data = png(size, dir);
    const head = Buffer.alloc(8);
    head.write(type, 0, "ascii");
    head.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([head, data]);
  });
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
  return Buffer.concat([head, ...chunks]);
}

render(smallSource, SMALL_SIZES, smallDir);
render(fullSource, FULL_SIZES, fullDir);

const copies = {
  "32x32.png": 32,
  "128x128.png": 128,
  "128x128@2x.png": 256,
  "icon.png": 512,
  "Square30x30Logo.png": 30,
  "Square44x44Logo.png": 44,
  "Square71x71Logo.png": 71,
  "Square89x89Logo.png": 89,
  "Square107x107Logo.png": 107,
  "Square142x142Logo.png": 142,
  "Square150x150Logo.png": 150,
  "Square284x284Logo.png": 284,
  "Square310x310Logo.png": 310,
  "StoreLogo.png": 50,
};
for (const [name, size] of Object.entries(copies)) {
  copyFileSync(pngPath(size), join(iconsDir, name));
}

writeFileSync(join(iconsDir, "icon.ico"), buildIco([16, 24, 32, 48, 64, 256]));
writeFileSync(
  join(iconsDir, "icon.icns"),
  // 1x 16/32 px would need raw ARGB chunks; macOS derives them from the 2x entries below.
  buildIcns([
    ["ic11", 32, smallDir],
    ["ic12", 64, smallDir],
    ["ic07", 128],
    ["ic08", 256],
    ["ic09", 512],
    ["ic10", 1024],
    ["ic13", 256],
    ["ic14", 512],
  ]),
);

rmSync(tmp, { recursive: true, force: true });
