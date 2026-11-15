import { describe, expect, it } from "vite-plus/test";

import type { ChatSession, WorkEnvironment } from "@/shared/stores/ai";
import type { FileSystemNode } from "@/shared/stores/fileExplorer";

import { withListing } from "./treeListing";
import { repositoryWorktrees } from "./worktreeView";

function environment(id: string, overrides: Partial<WorkEnvironment> = {}): WorkEnvironment {
  return {
    id,
    rootPath: "/repo",
    kind: "worktree",
    path: `/worktrees/${id}`,
    branch: `pragma/${id}`,
    setupStatus: "ready",
    setupLog: "",
    ...overrides,
  };
}

function session(id: string, environmentId: string, updatedAt: number): ChatSession {
  return { id, title: id, messages: [], createdAt: 0, updatedAt, rootPath: "/repo", environmentId };
}

function file(path: string): FileSystemNode {
  return { path, name: path.split("/").pop() ?? path, isDirectory: false, isFile: true };
}

function dir(path: string, children: FileSystemNode[] = []): FileSystemNode {
  return { path, name: path.split("/").pop() ?? path, isDirectory: true, isFile: false, children };
}

describe("repositoryWorktrees", () => {
  it("lists only the repository's ready worktrees", () => {
    const list = repositoryWorktrees(
      "/repo",
      [
        environment("a"),
        environment("b", { setupStatus: "error" }),
        environment("c", { kind: "checkout" }),
        environment("d", { rootPath: "/other" }),
      ],
      [],
    );
    expect(list.map((item) => item.environment.id)).toEqual(["a"]);
    expect(list[0].sessionId).toBeNull();
  });

  it("names the newest session that works in a worktree", () => {
    const list = repositoryWorktrees(
      "/repo",
      [environment("a")],
      [session("old", "a", 1), session("new", "a", 5), session("elsewhere", "b", 9)],
    );
    expect(list[0].sessionId).toBe("new");
  });
});

describe("withListing", () => {
  it("merges a root listing and keeps loaded folders", () => {
    const loaded = dir("/w/src", [file("/w/src/a.ts")]);
    const next = withListing([loaded], "/w", "/w", [dir("/w/src"), file("/w/b.ts")]);
    expect(next[0]).toBe(loaded);
    expect(next.map((node) => node.path)).toEqual(["/w/src", "/w/b.ts"]);
  });

  it("sets the children of a nested folder", () => {
    const tree = [dir("/w/src", [dir("/w/src/lib")])];
    const next = withListing(tree, "/w", "/w/src/lib", [file("/w/src/lib/x.ts")]);
    expect(next[0].children?.[0].children?.map((node) => node.path)).toEqual(["/w/src/lib/x.ts"]);
  });
});
