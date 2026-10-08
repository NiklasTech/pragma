import { describe, expect, it } from "vite-plus/test";
import { highlight } from "@/features/ai/components/chat-code-lezer";
import { detectLanguage } from "@/shared/lib/language";
import { loadLanguage } from "./languages";

describe("detectLanguage", () => {
  it("recognizes files by their full name", () => {
    expect(detectLanguage("Dockerfile")).toBe("dockerfile");
    expect(detectLanguage("/repo/build/Makefile")).toBe("makefile");
    expect(detectLanguage("C:\\repo\\Gemfile")).toBe("ruby");
  });

  it("maps the new extensions", () => {
    expect(detectLanguage("deploy.sh")).toBe("shell");
    expect(detectLanguage("app.rb")).toBe("ruby");
    expect(detectLanguage("Program.cs")).toBe("csharp");
    expect(detectLanguage("main.swift")).toBe("swift");
    expect(detectLanguage("build.zig")).toBe("zig");
    expect(detectLanguage("setup.ps1")).toBe("powershell");
    expect(detectLanguage(".bashrc")).toBeUndefined();
  });
});

describe("loadLanguage", () => {
  it("loads legacy modes by extension and file name", async () => {
    for (const file of ["run.sh", "Gemfile", "Cargo.toml", "/repo/Dockerfile", "Makefile"]) {
      expect(await loadLanguage(file), file).not.toEqual([]);
    }
  });

  it("loads the Zig grammar", async () => {
    expect(await loadLanguage("main.zig")).not.toEqual([]);
  });

  it("adds Emmet next to HTML-like languages", async () => {
    const extension = await loadLanguage("index.html");
    expect(Array.isArray(extension) && extension.length).toBe(2);
  });

  it("returns no extension for unknown files", async () => {
    expect(await loadLanguage("notes.unknownext")).toEqual([]);
  });
});

describe("makefile mode", () => {
  it("highlights assignments, targets, variables and comments", async () => {
    const nodes = await highlight("CC := gcc\nall: main.o # build\n\t$(CC) -o app", "makefile");
    const classOf = (value: string) =>
      nodes?.find((node) => node.kind === "text" && node.value === value);
    expect(classOf("CC")).toMatchObject({ cls: "tok-variableName" });
    expect(classOf("all")).toMatchObject({ cls: "tok-definition tok-variableName" });
    expect(classOf("# build")).toMatchObject({ cls: "tok-comment" });
    expect(classOf("$(CC)")).toMatchObject({ cls: "tok-variableName" });
  });
});
