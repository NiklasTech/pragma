import { describe, expect, it } from "vite-plus/test";
import type { FileSystemNode } from "@/shared/stores/fileExplorer";
import { changedDirectories, mergeChildren } from "./fileTreeRefresh";

function file(path: string): FileSystemNode {
  return { path, name: path.split("/").pop() ?? path, isDirectory: false, isFile: true };
}

function dir(path: string, children: FileSystemNode[] = []): FileSystemNode {
  return { path, name: path.split("/").pop() ?? path, isDirectory: true, isFile: false, children };
}

describe("changedDirectories", () => {
  it("includes each changed path and its parent", () => {
    expect(changedDirectories(["/w/src/a.ts", "/w/src/b.ts", "/w/lib"])).toEqual(
      new Set(["/w/src/a.ts", "/w/src", "/w/src/b.ts", "/w/lib", "/w"]),
    );
  });
});

describe("mergeChildren", () => {
  it("adds new entries, drops removed ones and keeps loaded subtrees", () => {
    const loaded = dir("/w/src", [file("/w/src/a.ts")]);
    const previous = [loaded, file("/w/old.ts")];
    const next = [dir("/w/src"), dir("/w/new"), file("/w/added.ts")];

    const merged = mergeChildren(previous, next);

    expect(merged.map((n) => n.path)).toEqual(["/w/src", "/w/new", "/w/added.ts"]);
    expect(merged[0]).toBe(loaded);
  });

  it("replaces a node whose type changed", () => {
    const next = [dir("/w/thing")];

    expect(mergeChildren([file("/w/thing")], next)[0]).toBe(next[0]);
  });
});
