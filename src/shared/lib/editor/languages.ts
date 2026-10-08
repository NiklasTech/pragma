import { StreamLanguage } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { legacyModeLoaders } from "./legacyModes";

export type LanguageLoader = () => Promise<Extension>;

type EmmetSyntax = "html" | "jsx" | "tsx" | "vue";

const legacyMode =
  (mode: string): LanguageLoader =>
  async () => {
    const load = legacyModeLoaders[mode];
    return load ? StreamLanguage.define(await load()) : [];
  };

const withEmmet =
  (loader: LanguageLoader, syntax: EmmetSyntax): LanguageLoader =>
  async () => {
    const [language, emmet] = await Promise.all([loader(), import("@emmetio/codemirror6-plugin")]);
    return [language, emmet.abbreviationTracker({ syntax: emmet.EmmetKnownSyntax[syntax] })];
  };

const languageMap: Record<string, LanguageLoader> = {
  // JavaScript / TypeScript
  js: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  jsx: withEmmet(
    () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
    "jsx",
  ),
  ts: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  tsx: withEmmet(
    () =>
      import("@codemirror/lang-javascript").then((m) =>
        m.javascript({ typescript: true, jsx: true }),
      ),
    "tsx",
  ),
  mjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  cjs: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),

  // Rust
  rs: () => import("@codemirror/lang-rust").then((m) => m.rust()),

  // Python
  py: () => import("@codemirror/lang-python").then((m) => m.python()),
  pyi: () => import("@codemirror/lang-python").then((m) => m.python()),
  pyw: () => import("@codemirror/lang-python").then((m) => m.python()),

  // Go
  go: () => import("@codemirror/lang-go").then((m) => m.go()),

  // HTML
  html: withEmmet(() => import("@codemirror/lang-html").then((m) => m.html()), "html"),
  htm: withEmmet(() => import("@codemirror/lang-html").then((m) => m.html()), "html"),

  // CSS
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  scss: () => import("@codemirror/lang-sass").then((m) => m.sass({ indented: false })),
  sass: () => import("@codemirror/lang-sass").then((m) => m.sass({ indented: true })),
  less: () => import("@codemirror/lang-css").then((m) => m.css()),

  // JSON
  json: () => import("@codemirror/lang-json").then((m) => m.json()),

  // Markdown
  md: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  mdx: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),

  // SQL
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
  mysql: () => import("@codemirror/lang-sql").then((m) => m.sql({ dialect: m.MySQL })),
  pgsql: () => import("@codemirror/lang-sql").then((m) => m.sql({ dialect: m.PostgreSQL })),
  sqlite: () => import("@codemirror/lang-sql").then((m) => m.sql({ dialect: m.SQLite })),

  // YAML
  yml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),
  yaml: () => import("@codemirror/lang-yaml").then((m) => m.yaml()),

  // XML
  xml: () => import("@codemirror/lang-xml").then((m) => m.xml()),
  svg: () => import("@codemirror/lang-xml").then((m) => m.xml()),

  // C / C++
  c: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  h: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  hpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  cc: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  cxx: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),

  // Java
  java: () => import("@codemirror/lang-java").then((m) => m.java()),

  // PHP
  php: () => import("@codemirror/lang-php").then((m) => m.php()),

  // Vue
  vue: withEmmet(() => import("@codemirror/lang-vue").then((m) => m.vue()), "vue"),

  // Angular
  angular: () => import("@codemirror/lang-angular").then((m) => m.angular()),

  // Liquid
  liquid: () => import("@codemirror/lang-liquid").then((m) => m.liquid()),

  // Shell
  sh: legacyMode("shell"),
  bash: legacyMode("shell"),
  zsh: legacyMode("shell"),

  // Ruby
  rb: legacyMode("ruby"),
  rake: legacyMode("ruby"),
  gemspec: legacyMode("ruby"),
  ru: legacyMode("ruby"),

  // TOML
  toml: legacyMode("toml"),

  // Dockerfile
  dockerfile: legacyMode("dockerfile"),

  // Kotlin
  kt: legacyMode("kotlin"),
  kts: legacyMode("kotlin"),

  // Swift
  swift: legacyMode("swift"),

  // C#
  cs: legacyMode("csharp"),

  // Lua
  lua: legacyMode("lua"),

  // PowerShell
  ps1: legacyMode("powershell"),
  psm1: legacyMode("powershell"),
  psd1: legacyMode("powershell"),

  // Makefile
  mk: legacyMode("makefile"),
  mak: legacyMode("makefile"),

  // Dart
  dart: legacyMode("dart"),

  // Zig
  zig: () => import("codemirror-lang-zig").then((m) => m.zig()),
};

// Files recognized by their full name rather than an extension.
const fileNameMap: Record<string, LanguageLoader> = {
  dockerfile: legacyMode("dockerfile"),
  containerfile: legacyMode("dockerfile"),
  makefile: legacyMode("makefile"),
  gnumakefile: legacyMode("makefile"),
  gemfile: legacyMode("ruby"),
  rakefile: legacyMode("ruby"),
};

export function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filename.length - 1) return "";
  return filename.slice(dotIndex + 1).toLowerCase();
}

function getBaseName(filename: string): string {
  const slashIndex = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  return filename.slice(slashIndex + 1).toLowerCase();
}

export async function loadLanguage(filename: string): Promise<Extension> {
  const loader = fileNameMap[getBaseName(filename)] ?? languageMap[getExtension(filename)];
  if (!loader) return [];
  try {
    return await loader();
  } catch {
    return [];
  }
}

export const supportedLanguageCount = Object.keys(languageMap).length;
