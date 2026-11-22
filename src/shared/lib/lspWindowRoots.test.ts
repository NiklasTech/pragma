import { describe, expect, it } from "vite-plus/test";

import { ownsProjectRoot } from "./lspWindowRoots";

describe("ownsProjectRoot", () => {
  const roots = ["/code/app", "/data/worktrees/app/feature"];

  it("owns servers of its folders and of packages inside them", () => {
    expect(ownsProjectRoot("/code/app", roots)).toBe(true);
    expect(ownsProjectRoot("/code/app/packages/web", roots)).toBe(true);
  });

  it("owns servers of its agents' worktrees", () => {
    expect(ownsProjectRoot("/data/worktrees/app/feature", roots)).toBe(true);
  });

  it("owns a server rooted above an opened subfolder", () => {
    expect(ownsProjectRoot("/code", ["/code/app/packages/web"])).toBe(true);
  });

  it("leaves servers of other windows' folders alone", () => {
    expect(ownsProjectRoot("/code/other", roots)).toBe(false);
    expect(ownsProjectRoot("/code/application", roots)).toBe(false);
  });
});
