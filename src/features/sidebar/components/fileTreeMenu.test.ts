import { describe, expect, it, vi } from "vite-plus/test";

import { fileTreeMenu } from "./fileTreeMenu";

function actions() {
  return {
    open: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    remove: vi.fn(),
    showLocalHistory: vi.fn(),
    showFileHistory: vi.fn(),
    addToChat: vi.fn(),
    copyPaths: vi.fn(),
    reveal: vi.fn(),
    openInTerminal: vi.fn(),
    duplicate: vi.fn(),
  };
}

const file = { path: "/repo/src/main.ts", name: "main.ts", isDirectory: false, isFile: true };

describe("fileTreeMenu", () => {
  it("names the file inside the folder and can open it", () => {
    const menu = fileTreeMenu(file, [file.path], "/repo", actions());
    expect(menu.head).toBe("src/main.ts");
    expect(menu.groups[0].items[0].label).toBe("open");
  });

  it("acts on every selected item at once", () => {
    const run = actions();
    const menu = fileTreeMenu(file, ["/repo/a", "/repo/b"], "/repo", run);
    expect(menu.head).toBe("2 items selected");
    menu.groups[0].items[0].onSelect();
    expect(run.addToChat).toHaveBeenCalledWith(["/repo/a", "/repo/b"]);
  });

  it("keeps a repository's own folder from being renamed or deleted", () => {
    const root = { ...file, isDirectory: true, isFile: false, repositoryRoot: true };
    const labels = fileTreeMenu(root, [root.path], "/repo", actions()).groups.flatMap((group) =>
      group.items.map((item) => item.label),
    );
    expect(labels).not.toContain("delete");
    expect(labels).toContain("new file here");
  });
});
