import { describe, expect, it } from "vite-plus/test";

import {
  AUTO_CONTEXT_TOKEN_CAP,
  capAutoContextSections,
  estimateTokens,
  type AutoContextSection,
} from "@/shared/lib/chat-context";

import {
  assembleAutoContext,
  buildAutoContextPrompt,
  relativePath,
  type AutoContextInput,
} from "./autoContext";

function section(id: string, label: string, size: number): AutoContextSection {
  return { id, label, content: "x".repeat(size) };
}

describe("capAutoContextSections", () => {
  it("includes whole sections while they fit", () => {
    const result = capAutoContextSections(
      [section("a", "Alpha", 30), section("b", "Beta", 30)],
      100,
    );

    expect(result.attachments.map((attachment) => attachment.id)).toEqual(["a", "b"]);
    expect(result.truncated).toBe(false);
    expect(estimateTokens(result.text)).toBeLessThanOrEqual(100);
  });

  it("never exceeds the token cap", () => {
    const result = capAutoContextSections(
      [section("a", "Alpha", 900), section("b", "Beta", 900)],
      100,
    );

    expect(estimateTokens(result.text)).toBeLessThanOrEqual(100);
    expect(result.tokensUsed).toBeLessThanOrEqual(100);
    expect(result.truncated).toBe(true);
    expect(result.text).toContain("[context truncated to fit the token cap]");
  });

  it("truncates the overflowing section and drops the rest", () => {
    const result = capAutoContextSections(
      [section("a", "Alpha", 200), section("b", "Beta", 200)],
      100,
    );

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]?.id).toBe("a");
    expect(result.truncated).toBe(true);
    expect(result.text).not.toContain("Beta");
    expect(estimateTokens(result.text)).toBeLessThanOrEqual(100);
  });

  it("skips empty sections", () => {
    const result = capAutoContextSections([
      { id: "empty", label: "Empty", content: "   " },
      section("a", "Alpha", 30),
    ]);

    expect(result.attachments.map((attachment) => attachment.id)).toEqual(["a"]);
  });

  it("uses a hard fallback cap", () => {
    expect(AUTO_CONTEXT_TOKEN_CAP).toBeGreaterThan(0);
    const result = capAutoContextSections([section("a", "Alpha", 100)]);
    expect(estimateTokens(result.text)).toBeLessThanOrEqual(AUTO_CONTEXT_TOKEN_CAP);
  });
});

describe("assembleAutoContext", () => {
  const baseInput: AutoContextInput = {
    rootPath: "/root",
    activeFile: {
      path: "/root/src/app.ts",
      content: "const value = 1;",
      selection: "const value = 1;",
    },
    openTabs: [
      { path: "/root/src/app.ts", name: "app.ts", content: "const value = 1;" },
      { path: "/root/src/other.ts", name: "other.ts", content: "export const other = 2;" },
    ],
    gitDiff: "diff --git a/src/app.ts b/src/app.ts",
    terminalOutput: "npm test\nall passing",
    sources: { activeFile: true, openTabs: true, gitDiff: true, terminal: true },
  };

  it("attaches every enabled source within the cap", () => {
    const result = assembleAutoContext(baseInput);

    expect(result.attachments.map((attachment) => attachment.id)).toEqual([
      "active-file",
      "open-tabs",
      "git-diff",
      "terminal",
    ]);
    expect(result.text).toContain("src/app.ts");
    expect(result.text).toContain("Selected code:");
    expect(result.text).toContain("src/other.ts");
    expect(result.text).toContain("all passing");
    expect(estimateTokens(result.text)).toBeLessThanOrEqual(AUTO_CONTEXT_TOKEN_CAP);
  });

  it("lists only other open tabs and excludes the active file", () => {
    const result = assembleAutoContext(baseInput);
    const tabs = result.attachments.find((attachment) => attachment.id === "open-tabs");

    expect(tabs).toBeDefined();
    expect(result.text.split("src/other.ts")).toHaveLength(2);
  });

  it("omits disabled sources", () => {
    const result = assembleAutoContext({
      ...baseInput,
      sources: { activeFile: true, openTabs: false, gitDiff: false, terminal: false },
    });

    expect(result.attachments.map((attachment) => attachment.id)).toEqual(["active-file"]);
    expect(result.text).not.toContain("all passing");
  });

  it("respects a caller-provided token cap", () => {
    const result = assembleAutoContext({
      ...baseInput,
      gitDiff: "d".repeat(9000),
      maxTokens: 50,
    });

    expect(estimateTokens(result.text)).toBeLessThanOrEqual(50);
    expect(result.truncated).toBe(true);
  });

  it("returns empty output when no source has content", () => {
    const result = assembleAutoContext({
      ...baseInput,
      activeFile: null,
      openTabs: [],
      gitDiff: null,
      terminalOutput: null,
    });

    expect(result.attachments).toHaveLength(0);
    expect(buildAutoContextPrompt(result)).toBe("");
  });
});

describe("relativePath", () => {
  it("strips the workspace root", () => {
    expect(relativePath("/root", "/root/src/app.ts")).toBe("src/app.ts");
    expect(relativePath("C:\\root", "C:\\root\\src\\app.ts")).toBe("src/app.ts");
    expect(relativePath(null, "/root/src/app.ts")).toBe("/root/src/app.ts");
  });
});
