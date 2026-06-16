import { describe, expect, it } from "vite-plus/test";
import {
  applySimpleTheme,
  loadSimpleTheme,
  simpleThemeToCssVariables,
  validateSimpleTheme,
  type SimpleTheme,
} from "./loader";

const tokyoNight: SimpleTheme = {
  name: "Tokyo Night",
  base: "dark",
  colors: {
    background: "#1a1b26",
    foreground: "#c0caf5",
    accent: "#7aa2f7",
    "terminal.background": "#1a1b26",
    "editor.cursor": "#c0caf5",
    "git.added": "#9ece6a",
    "git.modified": "#e0af68",
    "git.deleted": "#f7768e",
  },
  fonts: {
    editor: "JetBrains Mono",
    terminal: "JetBrains Mono",
    ui: "Inter",
  },
};

describe("validateSimpleTheme", () => {
  it("accepts a valid theme", () => {
    const result = validateSimpleTheme(tokyoNight);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a missing name", () => {
    const result = validateSimpleTheme({ ...tokyoNight, name: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("name must be a non-empty string");
  });

  it("rejects an invalid base", () => {
    const result = validateSimpleTheme({ ...tokyoNight, base: "blue" as "dark" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('base must be "dark" or "light"');
  });

  it("rejects non-string color values", () => {
    const result = validateSimpleTheme({
      ...tokyoNight,
      colors: { background: 123 as unknown as string },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("colors.background must be a string");
  });

  it("rejects invalid color values", () => {
    const result = validateSimpleTheme({
      ...tokyoNight,
      colors: { background: "not-a-color" },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('colors.background has invalid color value "not-a-color"');
  });

  it("accepts rgba and hsla values", () => {
    const result = validateSimpleTheme({
      ...tokyoNight,
      colors: {
        ...tokyoNight.colors,
        background: "rgba(26, 27, 38, 0.9)",
        foreground: "hsla(220, 50%, 80%, 0.8)",
      },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid fonts shape", () => {
    const result = validateSimpleTheme({
      ...tokyoNight,
      fonts: { editor: 123 as unknown as string },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("fonts.editor must be a string");
  });
});

describe("loadSimpleTheme", () => {
  it("parses and validates JSON", () => {
    const loaded = loadSimpleTheme(JSON.stringify(tokyoNight));
    expect(loaded.name).toBe("Tokyo Night");
    expect(loaded.base).toBe("dark");
  });

  it("throws on invalid JSON", () => {
    expect(() => loadSimpleTheme("not json")).toThrow("Failed to parse theme JSON");
  });

  it("throws on invalid theme content", () => {
    expect(() => loadSimpleTheme('{"name":"x","base":"dark","colors":{}}')).toThrow(
      "Invalid simple theme",
    );
  });
});

describe("simpleThemeToCssVariables", () => {
  it("maps top-level color keys to CSS variables", () => {
    const vars = simpleThemeToCssVariables(tokyoNight);

    expect(vars).toContainEqual({ name: "--bg-root", value: "#1a1b26" });
    expect(vars).toContainEqual({ name: "--fg-default", value: "#c0caf5" });
    expect(vars).toContainEqual({ name: "--color-accent", value: "#7aa2f7" });
  });

  it("maps dotted color keys to dashed CSS variables", () => {
    const vars = simpleThemeToCssVariables(tokyoNight);

    expect(vars).toContainEqual({ name: "--terminal-bg", value: "#1a1b26" });
    expect(vars).toContainEqual({ name: "--editor-cursor", value: "#c0caf5" });
    expect(vars).toContainEqual({ name: "--color-git-added", value: "#9ece6a" });
  });

  it("maps fonts to CSS variables", () => {
    const vars = simpleThemeToCssVariables(tokyoNight);

    expect(vars).toContainEqual({ name: "--font-sans", value: "Inter" });
    expect(vars).toContainEqual({ name: "--font-mono", value: "JetBrains Mono" });
    expect(vars).toContainEqual({ name: "--font-terminal", value: "JetBrains Mono" });
  });

  it("falls back to a generic variable for unknown keys", () => {
    const vars = simpleThemeToCssVariables({
      ...tokyoNight,
      colors: { "custom.unknown": "#123456" },
    });

    expect(vars).toContainEqual({ name: "--custom-unknown", value: "#123456" });
  });
});

describe("applySimpleTheme", () => {
  it("does not throw when document is undefined", () => {
    expect(() => applySimpleTheme(tokyoNight)).not.toThrow();
  });
});
