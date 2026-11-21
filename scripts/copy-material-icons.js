import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const theme = join(root, "node_modules", "material-icon-theme");
const source = join(theme, "icons");
const target = join(root, "public", "icons", "material-icon-theme");

if (!existsSync(source)) {
  console.warn(`Material icon source not found: ${source}`);
  process.exit(0);
}

// The file explorer only shows file icons (src/shared/lib/file-icons.ts), so folder icons stay out.
const manifest = JSON.parse(readFileSync(join(theme, "dist", "material-icons.json"), "utf8"));
const ids = new Set([
  manifest.file,
  ...Object.values(manifest.fileNames),
  ...Object.values(manifest.fileExtensions),
]);
// The explorer loads `<id>.svg`; some ids point at a differently named file such as `x.clone.svg`.
const files = new Map(
  [...ids].map((id) => [`${id}.svg`, basename(manifest.iconDefinitions[id]?.iconPath ?? "")]),
);

mkdirSync(target, { recursive: true });
for (const name of readdirSync(target)) {
  if (!files.has(name)) rmSync(join(target, name));
}
let copied = 0;
for (const [name, file] of files) {
  if (!file || !existsSync(join(source, file))) continue;
  copyFileSync(join(source, file), join(target, name));
  copied += 1;
}
console.log(`Copied ${copied} material file icons to ${target}`);
