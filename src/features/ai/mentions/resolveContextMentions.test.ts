import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { useProblemsStore } from "@/shared/stores/problems";

import { readContextMentions } from "./resolveContextMentions";

const ROOT = "/w";

describe("readContextMentions", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useProblemsStore.getState().setProblems([]);
  });

  it("attaches the problems of one file", async () => {
    useProblemsStore.getState().setProblems([
      {
        id: "1",
        severity: "error",
        message: "Bad type",
        filePath: "/w/src/a.ts",
        line: 3,
        column: 5,
        source: "ts",
      },
      {
        id: "2",
        severity: "warning",
        message: "Unused",
        filePath: "/w/src/b.ts",
        line: 1,
        column: 1,
        source: "ts",
      },
    ]);
    const text = await readContextMentions([{ kind: "problems", path: "src/a.ts" }], ROOT);
    expect(text).toBe("--- Problems in src/a.ts ---\n/w/src/a.ts:3:5: error: Bad type [ts]");
  });

  it("attaches staged changes and a commit diff", async () => {
    invokeMock.mockImplementation((command: string) =>
      Promise.resolve({ diff_text: `${command} output\n`, truncated: false }),
    );
    const text = await readContextMentions(
      [
        { kind: "diff", target: "staged" },
        { kind: "diff", target: "commit", sha: "abc1234" },
      ],
      ROOT,
    );
    expect(invokeMock).toHaveBeenCalledWith("git_diff", {
      repoPath: ROOT,
      path: null,
      staged: true,
    });
    expect(invokeMock).toHaveBeenCalledWith("git_show_commit", { repoPath: ROOT, sha: "abc1234" });
    expect(text).toBe(
      "--- Staged changes ---\ngit_diff output\n\n--- Commit abc1234 ---\ngit_show_commit output",
    );
  });

  it("attaches the fetched text of a URL", async () => {
    invokeMock.mockResolvedValue({
      url: "https://example.com",
      status: 200,
      contentType: "text/html",
      text: "Hello",
      truncated: false,
    });
    const text = await readContextMentions([{ kind: "url", url: "https://example.com" }], ROOT);
    expect(invokeMock).toHaveBeenCalledWith("fetch_url_text", { url: "https://example.com" });
    expect(text).toContain("https://example.com (HTTP 200, text/html)\n\nHello");
  });

  it("attaches a skill file", async () => {
    invokeMock.mockResolvedValue({ content: "---\nname: Ship\n---\n## Steps\n1. Go\n" });
    const text = await readContextMentions([{ kind: "skill", id: "ship" }], ROOT);
    expect(invokeMock).toHaveBeenCalledWith("read_text_file", {
      path: "/w/.pragma/skills/ship.md",
    });
    expect(text).toContain("--- Skill ship (.pragma/skills/ship.md) ---\nFollow this skill");
  });

  function mockSymbolFile(symbols: unknown[]) {
    const content = Array.from({ length: 60 }, (_, index) => `line ${index + 1}`).join("\n");
    invokeMock.mockImplementation((command: string) => {
      if (command === "read_text_file") return Promise.resolve({ content });
      if (command === "lsp_document_symbol") return Promise.resolve(symbols);
      return Promise.resolve(undefined);
    });
  }

  it("attaches the source range the language server reports for a symbol", async () => {
    mockSymbolFile([
      {
        name: "run",
        kind: 12,
        depth: 0,
        range: { start: { line: 9, character: 0 }, end: { line: 11, character: 1 } },
      },
    ]);
    const text = await readContextMentions(
      [{ kind: "symbol", name: "run", path: "src/a.ts", line: 10 }],
      ROOT,
    );
    expect(text).toBe("--- Symbol run (src/a.ts:10-12) ---\n```\nline 10\nline 11\nline 12\n```");
  });

  it("falls back to the lines after a symbol the language server does not know", async () => {
    mockSymbolFile([]);
    const text = await readContextMentions(
      [{ kind: "symbol", name: "run", path: "src/a.ts", line: 50 }],
      ROOT,
    );
    expect(text).toContain("--- Symbol run (src/a.ts:50-60) ---\n```\nline 50\n");
    expect(text).toContain("line 60\n```");
  });

  it("names the mention that could not be read", async () => {
    await expect(
      readContextMentions([{ kind: "terminal", sessionId: "missing" }], ROOT),
    ).rejects.toThrow("@terminal: The terminal is closed or not open in this window");
  });
});
