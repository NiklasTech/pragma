import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vite-plus/test";

const SRC = join(process.cwd(), "src");

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
    .map((file) => relative(process.cwd(), join(SRC, file)).split(sep).join("/"));
}

// Base UI throws "MenuGroupContext is missing" for a menu label outside a group, which takes down the app.
describe("menu labels", () => {
  it("sit inside a menu group", () => {
    const offenders = sourceFiles().filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("<DropdownMenuLabel") && !source.includes("<DropdownMenuGroup");
    });

    expect(offenders).toEqual([]);
  });
});
