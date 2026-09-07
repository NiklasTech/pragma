import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import {
  CHAR_CAP,
  RULES_FILENAMES,
  formatRulesForPrompt,
  loadProjectRules,
  selectRulesFile,
  truncateRulesContent,
} from "./rules";

describe("selectRulesFile", () => {
  it("prefers PRAGMA.md over the others", () => {
    expect(selectRulesFile(["CLAUDE.md", "AGENTS.md", "PRAGMA.md"])).toBe("PRAGMA.md");
  });

  it("falls back to AGENTS.md when PRAGMA.md is absent", () => {
    expect(selectRulesFile(["CLAUDE.md", "AGENTS.md"])).toBe("AGENTS.md");
  });

  it("falls back to CLAUDE.md when only it is present", () => {
    expect(selectRulesFile(["CLAUDE.md"])).toBe("CLAUDE.md");
  });

  it("returns null when none are present", () => {
    expect(selectRulesFile(["README.md", "notes.txt"])).toBeNull();
    expect(selectRulesFile([])).toBeNull();
  });

  it("exposes the canonical discovery order", () => {
    expect(RULES_FILENAMES).toEqual(["PRAGMA.md", "AGENTS.md", "CLAUDE.md"]);
  });
});

describe("truncateRulesContent", () => {
  it("keeps short content untouched", () => {
    const result = truncateRulesContent("short rules");
    expect(result).toEqual({ content: "short rules", truncated: false });
  });

  it("truncates long content and adds a visible note", () => {
    const source = "a".repeat(CHAR_CAP + 100);
    const result = truncateRulesContent(source);
    expect(result.truncated).toBe(true);
    expect(result.content.length).toBeGreaterThan(source.length - 100);
    expect(result.content).toContain("truncated");
    expect(result.content).toContain("[remaining content truncated]");
    expect(result.content.includes(source)).toBe(false);
  });

  it("never truncates silently at exactly the cap", () => {
    const source = "a".repeat(CHAR_CAP);
    expect(truncateRulesContent(source).truncated).toBe(false);
  });
});

describe("formatRulesForPrompt", () => {
  it("returns an empty string when there are no rules", () => {
    expect(formatRulesForPrompt(null)).toBe("");
  });

  it("labels the rules block with its file name", () => {
    const block = formatRulesForPrompt({
      path: "PRAGMA.md",
      source: "Do the thing",
      truncated: false,
    });
    expect(block).toContain("PRAGMA.md");
    expect(block).toContain("Do the thing");
  });
});

describe("loadProjectRules", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("reads PRAGMA.md first", async () => {
    invokeMock.mockResolvedValueOnce({
      path: "/root/PRAGMA.md",
      name: "PRAGMA.md",
      content: "rules",
    });
    const rules = await loadProjectRules("/root");
    expect(rules).toEqual({ path: "PRAGMA.md", source: "rules", truncated: false });
    expect(invokeMock).toHaveBeenCalledWith("read_text_file", { path: "/root/PRAGMA.md" });
  });

  it("falls back to the next file when reading fails", async () => {
    invokeMock
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce({ path: "/root/AGENTS.md", name: "AGENTS.md", content: "agents" });
    const rules = await loadProjectRules("/root");
    expect(rules?.path).toBe("AGENTS.md");
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when no rules file exists", async () => {
    invokeMock.mockRejectedValue(new Error("missing"));
    const rules = await loadProjectRules("/root");
    expect(rules).toBeNull();
    expect(invokeMock).toHaveBeenCalledTimes(RULES_FILENAMES.length);
  });
});
