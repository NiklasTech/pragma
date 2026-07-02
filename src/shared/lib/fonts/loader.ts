import { convertFileSrc } from "@tauri-apps/api/core";
import type { FontConfig, FontFileEntry } from "./types";

const FONT_FACE_STYLE_ID = "pragma-dynamic-fonts";

function getStyleElement(): HTMLStyleElement {
  let el = document.getElementById(FONT_FACE_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = FONT_FACE_STYLE_ID;
    document.head.appendChild(el);
  }
  return el;
}

function formatFaceRule(fontId: string, file: FontFileEntry): string {
  const url = convertFileSrc(file.path);
  const format = file.path.toLowerCase().endsWith(".otf")
    ? "opentype"
    : file.path.toLowerCase().endsWith(".woff2")
      ? "woff2"
      : file.path.toLowerCase().endsWith(".woff")
        ? "woff"
        : "truetype";
  return `
@font-face {
  font-family: "${fontId}";
  src: url("${url}") format("${format}");
  font-weight: ${file.weight};
  font-style: ${file.style};
  font-display: swap;
}`;
}

export function installFontFaces(fonts: FontConfig[]): void {
  const el = getStyleElement();
  const rules = fonts.map((font) =>
    font.files.map((file) => formatFaceRule(font.id, file)).join("\n"),
  );
  el.textContent = rules.join("\n");
}

export function fontFamilyStack(fontId: string | undefined, fallback: string): string {
  if (!fontId) return fallback;
  return `"${fontId}", ${fallback}`;
}
