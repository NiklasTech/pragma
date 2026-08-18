import type { RegisteredPanel } from "./store";

function collectThemeCssVariables(): string {
  if (typeof document === "undefined") return "";
  const style = document.documentElement.style;
  const vars: string[] = [];
  for (let i = 0; i < style.length; i++) {
    const name = style[i];
    if (name.startsWith("--")) {
      vars.push(`${name}: ${style.getPropertyValue(name)};`);
    }
  }
  return vars.join("\n");
}

const DEFAULT_BODY = '<p style="color: var(--fg-muted, #888)">This panel has no content.</p>';

export function buildPanelSrcDoc(panel: RegisteredPanel): string {
  const body = panel.html && panel.html.trim().length > 0 ? panel.html : DEFAULT_BODY;
  return [
    "<!doctype html>",
    '<html><head><meta charset="utf-8"><style>',
    `:root {\n${collectThemeCssVariables()}\n}`,
    "body { margin: 0; padding: 8px; background: var(--bg-root, transparent); color: var(--fg-default, inherit); font-family: system-ui, sans-serif; font-size: 12px; }",
    "</style></head><body>",
    body,
    "</body></html>",
  ].join("\n");
}
