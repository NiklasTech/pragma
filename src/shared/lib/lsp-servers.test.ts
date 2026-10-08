import { describe, expect, it } from "vite-plus/test";

import {
  LSP_SERVERS,
  isLspAutoInstallable,
  isLspSupported,
  shouldToastLspError,
} from "./lsp-servers";

describe("shouldToastLspError", () => {
  it("stays quiet for a language server that is not installed", () => {
    expect(shouldToastLspError({ status: "stopped", expected: true })).toBe(false);
    expect(shouldToastLspError({ status: "error", expected: true })).toBe(false);
  });

  it("toasts an unexpected failure", () => {
    expect(shouldToastLspError({ status: "error", expected: false })).toBe(true);
    expect(shouldToastLspError({ status: "error" })).toBe(true);
  });

  it("never toasts non-error statuses", () => {
    expect(shouldToastLspError({ status: "stopped" })).toBe(false);
    expect(shouldToastLspError({ status: "running" })).toBe(false);
    expect(shouldToastLspError({ status: "starting" })).toBe(false);
  });
});

describe("html/css server definitions", () => {
  it("install the package that ships both language server binaries", () => {
    for (const language of ["html", "css"]) {
      const definition = LSP_SERVERS[language];
      expect(definition.installArgs).toEqual(["install", "-g", "vscode-langservers-extracted"]);
    }
  });

  it("keep the official binary names", () => {
    expect(LSP_SERVERS.html.command).toBe("vscode-html-language-server");
    expect(LSP_SERVERS.css.command).toBe("vscode-css-language-server");
  });
});

describe("additional language presets", () => {
  it("match the detected language ids", () => {
    for (const language of ["shell", "ruby", "toml", "csharp", "swift", "zig"]) {
      expect(isLspSupported(language)).toBe(true);
      expect(LSP_SERVERS[language].language).toBe(language);
    }
  });

  it("only auto-install servers that ship through a package manager", () => {
    expect(isLspAutoInstallable("ruby")).toBe(true);
    expect(isLspAutoInstallable("toml")).toBe(true);
    expect(isLspAutoInstallable("swift")).toBe(false);
    expect(isLspAutoInstallable("zig")).toBe(false);
  });
});
