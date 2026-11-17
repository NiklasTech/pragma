import { describe, expect, it } from "vite-plus/test";

import { splitExtension } from "./extensionTint";

describe("splitExtension", () => {
  it("tints the extension and leaves dotfiles whole", () => {
    expect(splitExtension("math.ts")).toEqual({
      base: "math.",
      ext: "ts",
      tint: "text-status-info",
    });
    expect(splitExtension(".gitignore")).toEqual({ base: ".gitignore", ext: null, tint: "" });
    expect(splitExtension("Makefile").ext).toBeNull();
    expect(splitExtension("notes.xyz").tint).toBe("text-fg-subtle");
  });
});
