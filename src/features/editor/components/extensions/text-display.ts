import type { Extension } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  scrollPastEnd,
} from "@codemirror/view";

export const EDITOR_FONT_WEIGHT_DEFAULT = 400;
export const EDITOR_LETTER_SPACING_DEFAULT = 0;
export const EDITOR_PADDING_DEFAULT = 8;

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function clampEditorFontWeight(value: number): number {
  return clamp(Math.round(value / 100) * 100, 100, 900, EDITOR_FONT_WEIGHT_DEFAULT);
}

export function clampEditorLetterSpacing(value: number): number {
  return clamp(Math.round(value * 10) / 10, -2, 4, EDITOR_LETTER_SPACING_DEFAULT);
}

export function clampEditorPadding(value: number): number {
  return clamp(Math.round(value), 0, 48, EDITOR_PADDING_DEFAULT);
}

export function textStyleExtension(fontWeight: number, letterSpacing: number): Extension {
  const weight = clampEditorFontWeight(fontWeight);
  const spacing = clampEditorLetterSpacing(letterSpacing);
  if (weight === EDITOR_FONT_WEIGHT_DEFAULT && spacing === EDITOR_LETTER_SPACING_DEFAULT) return [];
  return EditorView.theme({
    ".cm-content": { fontWeight: String(weight), letterSpacing: `${spacing}px` },
  });
}

export function paddingExtension(padding: number): Extension {
  const value = clampEditorPadding(padding);
  if (value === EDITOR_PADDING_DEFAULT) return [];
  return EditorView.theme({ "&.cm-editor .cm-content": { padding: `${value}px 0` } });
}

export function activeLineExtension(enabled: boolean): Extension {
  return enabled ? [highlightActiveLine(), highlightActiveLineGutter()] : [];
}

export function scrollPastEndExtension(enabled: boolean): Extension {
  return enabled ? scrollPastEnd() : [];
}
