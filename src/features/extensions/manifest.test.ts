import { describe, expect, it } from "vite-plus/test";
import { validateExtensionManifest } from "./manifest";

const minimal = {
  format: "pragma-extension-v1",
  id: "hello-world",
  name: "Hello World",
  version: "0.1.0",
};

describe("validateExtensionManifest", () => {
  it("accepts a minimal valid manifest and defaults main", () => {
    const result = validateExtensionManifest(minimal);
    expect(result.valid).toBe(true);
    expect(result.manifest?.main).toBe("main.js");
  });

  it("rejects non-object input", () => {
    expect(validateExtensionManifest("nope").valid).toBe(false);
    expect(validateExtensionManifest(null).valid).toBe(false);
    expect(validateExtensionManifest([minimal]).valid).toBe(false);
  });

  it("rejects a wrong format", () => {
    const result = validateExtensionManifest({ ...minimal, format: "v2" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("format:"))).toBe(true);
  });

  it("rejects invalid ids", () => {
    expect(validateExtensionManifest({ ...minimal, id: "Upper" }).valid).toBe(false);
    expect(validateExtensionManifest({ ...minimal, id: ".." }).valid).toBe(false);
    expect(validateExtensionManifest({ ...minimal, id: "a/b" }).valid).toBe(false);
    expect(validateExtensionManifest({ ...minimal, id: "" }).valid).toBe(false);
  });

  it("rejects a main entry point escaping the extension folder", () => {
    expect(validateExtensionManifest({ ...minimal, main: "../escape.js" }).valid).toBe(false);
    expect(validateExtensionManifest({ ...minimal, main: "/abs.js" }).valid).toBe(false);
    expect(validateExtensionManifest({ ...minimal, main: "src/main.js" }).valid).toBe(true);
  });

  it("rejects commands without id or title", () => {
    const result = validateExtensionManifest({
      ...minimal,
      contributes: { commands: [{ id: "no-title" }] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.startsWith("contributes.commands[0]"))).toBe(true);
  });

  it("parses commands, panels and themes", () => {
    const result = validateExtensionManifest({
      ...minimal,
      description: "Example",
      contributes: {
        commands: [{ id: "hello", title: "Say Hello", category: "Examples" }],
        panels: [{ id: "panel", title: "My Panel", icon: "note", html: "<p>hi</p>" }],
        themes: [{ path: "theme.json" }],
      },
    });
    expect(result.valid).toBe(true);
    expect(result.manifest?.contributes?.commands?.[0]?.category).toBe("Examples");
    expect(result.manifest?.contributes?.panels?.[0]?.icon).toBe("note");
    expect(result.manifest?.contributes?.themes).toHaveLength(1);
  });

  it("rejects themes that are not objects", () => {
    const result = validateExtensionManifest({
      ...minimal,
      contributes: { themes: ["theme.json"] },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects panels with a non-string html", () => {
    const result = validateExtensionManifest({
      ...minimal,
      contributes: { panels: [{ id: "p", title: "P", html: 42 }] },
    });
    expect(result.valid).toBe(false);
  });
});
