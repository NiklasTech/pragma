import { describe, expect, it } from "vite-plus/test";
import { findPathLinks, isLinkModifier, resolveTerminalPath } from "./terminalLinks";

function paths(text: string) {
  return findPathLinks(text).map(({ path, line, column }) => ({ path, line, column }));
}

describe("path links in terminal output", () => {
  it("finds relative paths with an extension", () => {
    expect(paths("⏺ Update(src/theme/accent.ts)")).toEqual([
      { path: "src/theme/accent.ts", line: undefined, column: undefined },
    ]);
  });

  it("reads line and column suffixes", () => {
    expect(paths("src/app.tsx:12:5 - error TS2304")).toEqual([
      { path: "src/app.tsx", line: 12, column: 5 },
    ]);
    expect(paths("at render (src/view.ts:40)")).toEqual([
      { path: "src/view.ts", line: 40, column: undefined },
    ]);
    expect(paths("src/lib.rs(7,3): warning")).toEqual([{ path: "src/lib.rs", line: 7, column: 3 }]);
  });

  it("finds absolute, home and dot paths, also without extension", () => {
    expect(paths("cd /Users/me/project && ls ./scripts ~/notes/todo.md ../shared/x")).toEqual([
      { path: "/Users/me/project", line: undefined, column: undefined },
      { path: "./scripts", line: undefined, column: undefined },
      { path: "~/notes/todo.md", line: undefined, column: undefined },
      { path: "../shared/x", line: undefined, column: undefined },
    ]);
  });

  it("finds Windows paths", () => {
    expect(paths("error in C:\\work\\app\\main.rs:3")).toEqual([
      { path: "C:\\work\\app\\main.rs", line: 3, column: undefined },
    ]);
  });

  it("leaves words, URLs, SSH remotes and assignments alone", () => {
    expect(paths("use this and/or that")).toEqual([]);
    expect(paths("see https://example.com/docs/page.html for details")).toEqual([]);
    expect(paths("remote git@github.com:org/repo.git")).toEqual([]);
    expect(paths("KEY=config/app.json")).toEqual([]);
  });

  it("keeps scoped package paths", () => {
    expect(paths("node_modules/@scope/pkg/index.js")[0]?.path).toBe(
      "node_modules/@scope/pkg/index.js",
    );
  });

  it("reports offsets that cover the path and its position", () => {
    const [link] = findPathLinks("> src/a.ts:3 failed");
    expect(link.start).toBe(2);
    expect(link.end).toBe(12);
  });
});

describe("resolving terminal paths", () => {
  it("resolves relative paths against the working directory", () => {
    expect(resolveTerminalPath("src/a.ts", "/repo", null)).toBe("/repo/src/a.ts");
    expect(resolveTerminalPath("../b/c.ts", "/repo/app", null)).toBe("/repo/b/c.ts");
    expect(resolveTerminalPath("./x.ts", null, null)).toBeNull();
  });

  it("keeps absolute paths and expands the home folder", () => {
    expect(resolveTerminalPath("/etc/hosts", "/repo", null)).toBe("/etc/hosts");
    expect(resolveTerminalPath("~/notes.md", "/repo", "/Users/me")).toBe("/Users/me/notes.md");
    expect(resolveTerminalPath("~/notes.md", "/repo", null)).toBeNull();
    expect(resolveTerminalPath("C:\\a\\b.ts", null, null)).toBe("C:\\a\\b.ts");
  });
});

describe("link modifier", () => {
  it("uses Cmd on macOS and Ctrl elsewhere", () => {
    expect(isLinkModifier({ metaKey: true, ctrlKey: false }, true)).toBe(true);
    expect(isLinkModifier({ metaKey: false, ctrlKey: true }, true)).toBe(false);
    expect(isLinkModifier({ metaKey: false, ctrlKey: true }, false)).toBe(true);
    expect(isLinkModifier({ metaKey: false, ctrlKey: false }, false)).toBe(false);
  });
});
