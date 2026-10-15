import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const listings = vi.hoisted(() => ({ byPath: {} as Record<string, unknown[]> }));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (_command: string, args: { path: string }) => listings.byPath[args.path] ?? [],
}));

import { useFileExplorerStore, type FileSystemNode } from "@/shared/stores/fileExplorer";

import { refreshFileTree } from "./fileTreeRefresh";

function entry(path: string, isDirectory = false) {
  return { path, name: path.split("/").pop(), is_directory: isDirectory, is_file: !isDirectory };
}

function repository(path: string, children: FileSystemNode[]): FileSystemNode {
  const name = path.split("/").pop() ?? path;
  return { path, name, isDirectory: true, isFile: false, children, repositoryRoot: true };
}

function file(path: string): FileSystemNode {
  return { path, name: path.split("/").pop() ?? path, isDirectory: false, isFile: true };
}

describe("refreshFileTree with all repositories shown", () => {
  beforeEach(() => {
    listings.byPath = {};
    useFileExplorerStore.setState({
      rootPath: "/code/a",
      expandedDirs: new Set(["/code/a", "/code/b"]),
      tree: [
        repository("/code/a", [file("/code/a/one.ts")]),
        repository("/code/b", [file("/code/b/two.ts")]),
      ],
    });
  });

  it("refreshes the repository the change happened in and leaves the others alone", async () => {
    listings.byPath["/code/b"] = [entry("/code/b/two.ts"), entry("/code/b/three.ts")];

    await refreshFileTree("/code/b", ["/code/b/three.ts"]);

    const [a, b] = useFileExplorerStore.getState().tree;
    expect(a.children?.map((node) => node.path)).toEqual(["/code/a/one.ts"]);
    expect(b.repositoryRoot).toBe(true);
    expect(b.children?.map((node) => node.path)).toEqual(["/code/b/two.ts", "/code/b/three.ts"]);
  });

  it("keeps the top-level repository folders when the active repository changes on disk", async () => {
    listings.byPath["/code/a"] = [entry("/code/a/one.ts"), entry("/code/a/src", true)];

    await refreshFileTree("/code/a", ["/code/a/src"]);

    const tree = useFileExplorerStore.getState().tree;
    expect(tree.map((node) => node.path)).toEqual(["/code/a", "/code/b"]);
    expect(tree[0].children?.map((node) => node.path)).toEqual(["/code/a/one.ts", "/code/a/src"]);
  });
});
