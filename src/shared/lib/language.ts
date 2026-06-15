const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "c",
  hpp: "cpp",
  css: "css",
  go: "go",
  html: "html",
  htm: "html",
  java: "java",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  kt: "kotlin",
  kts: "kotlin",
  md: "markdown",
  mdx: "markdown",
  py: "python",
  rs: "rust",
  scss: "scss",
  sass: "sass",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  sql: "sql",
  svelte: "svelte",
  svg: "xml",
  toml: "toml",
  ts: "typescript",
  tsx: "typescript",
  vue: "vue",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

export function detectLanguage(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === filename.length - 1) return undefined;
  const ext = filename.slice(lastDot + 1).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext];
}
