import { describe, expect, it } from "vite-plus/test";

import type { FileSystemNode } from "@/shared/stores/fileExplorer";

import { isRepositoryTree, repositoryNodes } from "./repositoryTree";

function file(path: string): FileSystemNode {
  return { path, name: path.split("/").pop() ?? path, isDirectory: false, isFile: true };
}

const paths = ["/code/a", "/code/b"];

describe("repositoryNodes", () => {
  it("turns a single-root tree into one folder per repository with the active one filled", () => {
    const tree = repositoryNodes(paths, [file("/code/a/readme.md")], "/code/a");

    expect(tree.map((node) => [node.path, node.name, node.repositoryRoot])).toEqual([
      ["/code/a", "a", true],
      ["/code/b", "b", true],
    ]);
    expect(tree[0].children).toEqual([file("/code/a/readme.md")]);
    expect(tree[1].children).toEqual([]);
    expect(isRepositoryTree(tree, paths)).toBe(true);
  });

  it("keeps loaded repository folders and adds newly opened repositories", () => {
    const first = repositoryNodes(["/code/a"], [], "/code/a");
    const next = repositoryNodes(paths, first, "/code/a");

    expect(next[0]).toBe(first[0]);
    expect(isRepositoryTree(first, paths)).toBe(false);
    expect(isRepositoryTree(next, paths)).toBe(true);
  });
});
