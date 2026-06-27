import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function run(command, cwd) {
  return execSync(command, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "ignore"],
    maxBuffer: 50 * 1024 * 1024,
    timeout: 120_000,
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function normalizeLicense(license) {
  if (typeof license === "string") return license;
  if (license && typeof license === "object" && "type" in license) return license.type;
  if (Array.isArray(license) && license.length > 0) {
    return license.map((l) => (typeof l === "string" ? l : l.type)).join(" OR ");
  }
  return "Unknown";
}

function npmUrl(name, version) {
  if (version === "multiple") {
    const scope = getScope(name);
    if (scope) {
      return `https://www.npmjs.com/search?q=scope%3A${encodeURIComponent(scope.slice(1))}`;
    }
    return `https://www.npmjs.com/search?q=${encodeURIComponent(name)}`;
  }
  return `https://www.npmjs.com/package/${name}/v/${version}`;
}

function rustUrl(name, version) {
  return `https://crates.io/crates/${name}/${version}`;
}

const SCOPE_DISPLAY_NAMES = {
  "@ai-sdk": "AI SDK",
  "@base-ui": "Base UI",
  "@codemirror": "CodeMirror",
  "@fontsource": "Fontsource",
  "@fontsource-variable": "Fontsource",
  "@lezer": "Lezer",
  "@phosphor-icons": "Phosphor Icons",
  "@replit": "Replit",
  "@tailwindcss": "Tailwind CSS",
  "@tanstack": "TanStack",
  "@tauri-apps": "Tauri",
  "@uiw": "UIW React CodeMirror",
  "@xterm": "XTerm",
};

function getScope(name) {
  const parts = name.split("/");
  return parts.length > 1 ? parts[0] : null;
}

function collectNpmEntries() {
  const packageJson = readJson(resolve(root, "package.json"));
  const directDeps = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]);

  const packages = [];

  for (const name of directDeps) {
    try {
      const pkg = readJson(resolve(root, "node_modules", name, "package.json"));
      packages.push({
        name: pkg.name,
        version: pkg.version,
        license: normalizeLicense(pkg.license ?? pkg.licenses),
        url: npmUrl(pkg.name, pkg.version),
        source: "npm",
      });
    } catch {
      // Skip packages whose package.json cannot be read.
    }
  }

  const groups = new Map();
  const standalone = [];

  for (const pkg of packages) {
    const scope = getScope(pkg.name);
    const displayName = scope ? SCOPE_DISPLAY_NAMES[scope] : undefined;

    if (displayName) {
      const existing = groups.get(displayName);
      if (existing) {
        existing.licenses.add(pkg.license);
      } else {
        groups.set(displayName, {
          name: displayName,
          licenses: new Set([pkg.license]),
        });
      }
    } else {
      standalone.push(pkg);
    }
  }

  const grouped = Array.from(groups.values()).map((group) => ({
    name: group.name,
    version: "multiple",
    license: Array.from(group.licenses).join(" / "),
    url: npmUrl(group.name, "multiple"),
    source: "npm",
  }));

  return [...grouped, ...standalone];
}

function collectRustEntries() {
  const data = JSON.parse(
    run("cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1", root),
  );

  const rootPackage =
    data.packages.find((p) => p.id === data.resolve?.root) ??
    data.packages.find((p) => p.name === "app" && !p.source);

  if (!rootPackage) return [];

  const directDepNames = new Set(
    (rootPackage.dependencies ?? []).filter((dep) => dep.kind === null).map((dep) => dep.name),
  );

  const entries = [];
  const seen = new Set();

  for (const pkg of data.packages ?? []) {
    if (!pkg.source?.startsWith("registry+")) continue;
    if (!pkg.license) continue;
    if (!directDepNames.has(pkg.name)) continue;

    const key = `${pkg.name}@${pkg.version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      name: pkg.name,
      version: pkg.version,
      license: pkg.license,
      url: rustUrl(pkg.name, pkg.version),
      source: "rust",
    });
  }

  return entries;
}

const npmEntries = collectNpmEntries();
const rustEntries = collectRustEntries();

const entries = [...npmEntries, ...rustEntries].sort((a, b) => {
  const nameCompare = a.name.localeCompare(b.name);
  if (nameCompare !== 0) return nameCompare;
  return a.version.localeCompare(b.version);
});

const output = {
  generatedAt: new Date().toISOString(),
  total: entries.length,
  entries,
};

const outputPath = resolve(root, "public/third-party-licenses.json");
writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`Generated ${outputPath} with ${entries.length} entries`);
