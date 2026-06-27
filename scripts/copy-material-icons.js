import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "node_modules", "material-icon-theme", "icons");
const target = join(root, "public", "icons", "material-icon-theme");

if (!existsSync(source)) {
  console.warn(`Material icon source not found: ${source}`);
  process.exit(0);
}

if (!existsSync(target)) {
  mkdirSync(target, { recursive: true });
}

cpSync(source, target, { recursive: true, force: true });
console.log(`Copied material icons to ${target}`);
