import type { Extension } from "@codemirror/state";

export type LanguageLoader = () => Promise<Extension>;

const languageMap: Record<string, LanguageLoader> = {
  // JavaScript / TypeScript
  js: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  jsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  ts: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  tsx: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true, jsx: true }),
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
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  htm: () => import("@codemirror/lang-html").then((m) => m.html()),

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
  vue: () => import("@codemirror/lang-vue").then((m) => m.vue()),

  // Angular
  angular: () => import("@codemirror/lang-angular").then((m) => m.angular()),

  // Liquid
  liquid: () => import("@codemirror/lang-liquid").then((m) => m.liquid()),
};

export function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex === filename.length - 1) return "";
  return filename.slice(dotIndex + 1).toLowerCase();
}

export async function loadLanguage(filename: string): Promise<Extension> {
  const ext = getExtension(filename);
  const loader = languageMap[ext];
  if (!loader) return [];
  try {
    return await loader();
  } catch {
    return [];
  }
}

export function isLanguageSupported(filename: string): boolean {
  return getExtension(filename) in languageMap;
}

export const supportedLanguageCount = Object.keys(languageMap).length;
