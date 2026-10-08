const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  c: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  css: "css",
  dart: "dart",
  dockerfile: "dockerfile",
  gemspec: "ruby",
  go: "go",
  html: "html",
  htm: "html",
  java: "java",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  kt: "kotlin",
  kts: "kotlin",
  lua: "lua",
  mak: "makefile",
  md: "markdown",
  mdx: "markdown",
  mk: "makefile",
  ps1: "powershell",
  psd1: "powershell",
  psm1: "powershell",
  py: "python",
  rake: "ruby",
  rb: "ruby",
  rs: "rust",
  ru: "ruby",
  scss: "scss",
  sass: "sass",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  sql: "sql",
  svelte: "svelte",
  svg: "xml",
  swift: "swift",
  toml: "toml",
  ts: "typescript",
  tsx: "typescript",
  vue: "vue",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  zig: "zig",
};

const FILE_NAME_LANGUAGE_MAP: Record<string, string> = {
  containerfile: "dockerfile",
  dockerfile: "dockerfile",
  gemfile: "ruby",
  gnumakefile: "makefile",
  makefile: "makefile",
  rakefile: "ruby",
};

export function detectLanguage(filename: string): string | undefined {
  const baseName = filename.slice(
    Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\")) + 1,
  );
  const byName = FILE_NAME_LANGUAGE_MAP[baseName.toLowerCase()];
  if (byName) return byName;
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === filename.length - 1) return undefined;
  const ext = filename.slice(lastDot + 1).toLowerCase();
  return EXTENSION_LANGUAGE_MAP[ext];
}
