import { describe, expect, it } from "vite-plus/test";
import {
  activeLineExtension,
  clampEditorFontWeight,
  clampEditorLetterSpacing,
  clampEditorPadding,
  paddingExtension,
  scrollPastEndExtension,
  textStyleExtension,
} from "./text-display";

describe("editor text display options", () => {
  it("clamps font weight, letter spacing and padding", () => {
    expect(clampEditorFontWeight(0)).toBe(100);
    expect(clampEditorFontWeight(1000)).toBe(900);
    expect(clampEditorFontWeight(449)).toBe(400);
    expect(clampEditorFontWeight(Number.NaN)).toBe(400);
    expect(clampEditorLetterSpacing(9)).toBe(4);
    expect(clampEditorLetterSpacing(-9)).toBe(-2);
    expect(clampEditorLetterSpacing(0.26)).toBe(0.3);
    expect(clampEditorPadding(-5)).toBe(0);
    expect(clampEditorPadding(100)).toBe(48);
    expect(clampEditorPadding(Number.NaN)).toBe(8);
  });

  it("adds nothing for the defaults, so the editor looks like today", () => {
    expect(textStyleExtension(400, 0)).toEqual([]);
    expect(paddingExtension(8)).toEqual([]);
    expect(activeLineExtension(false)).toEqual([]);
    expect(scrollPastEndExtension(false)).toEqual([]);
  });

  it("adds an extension for changed values", () => {
    expect(textStyleExtension(600, 0)).not.toEqual([]);
    expect(paddingExtension(16)).not.toEqual([]);
    expect(activeLineExtension(true)).not.toEqual([]);
    expect(scrollPastEndExtension(true)).not.toEqual([]);
  });
});
