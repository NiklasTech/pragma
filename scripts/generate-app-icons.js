import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const logoPath = join(root, "public", "pragma_logo.svg");
const sourcePath = join(root, "src-tauri", "icon-source.svg");
const iconsDir = join(root, "src-tauri", "icons");

const logo = readFileSync(logoPath, "utf8");
const inner = logo.replace(/<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// The logo viewBox is 0 0 119.7 204. Center it in a 204x204 square canvas.
const squareSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 204 204">
  <rect width="204" height="204" fill="none"/>
  <g transform="translate(42.15, 0)">
    <svg width="119.7" height="204" viewBox="0 0 119.7 204">
      ${inner}
    </svg>
  </g>
</svg>`;

writeFileSync(sourcePath, squareSvg);

const result = spawnSync("pnpm", ["exec", "tauri", "icon", sourcePath, "-o", iconsDir], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});

unlinkSync(sourcePath);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
