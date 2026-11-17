const TINTS: Record<string, string> = {
  ts: "text-status-info",
  tsx: "text-status-info",
  mts: "text-status-info",
  cts: "text-status-info",
  js: "text-status-warning",
  jsx: "text-status-warning",
  mjs: "text-status-warning",
  cjs: "text-status-warning",
  json: "text-status-warning",
  jsonc: "text-status-warning",
  rs: "text-primary",
  toml: "text-primary",
  py: "text-status-success",
  go: "text-status-success",
  css: "text-[var(--color-git-conflict)]",
  scss: "text-[var(--color-git-conflict)]",
  html: "text-[var(--color-git-conflict)]",
  svg: "text-[var(--color-git-conflict)]",
};

/** A file name split into base and extension, with the color class its extension is shown in. */
export function splitExtension(name: string): { base: string; ext: string | null; tint: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return { base: name, ext: null, tint: "" };
  const ext = name.slice(dot + 1);
  return { base: name.slice(0, dot + 1), ext, tint: TINTS[ext.toLowerCase()] ?? "text-fg-subtle" };
}
