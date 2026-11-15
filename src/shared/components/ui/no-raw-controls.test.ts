import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vite-plus/test";

const SRC = join(process.cwd(), "src");
const UI_DIR = join("src", "shared", "components", "ui");

/** Raw elements that are not controls; each needs a reason. */
const ALLOWED: Record<string, string> = {
  "src/features/ai/review/ReviewHunkDiff.tsx": "a clickable diff line is code, not a control",
  "src/features/editor/components/EditorBreadcrumb.tsx":
    "breadcrumb links take their look from BreadcrumbLink",
  "src/shell/layout/components/TabsContainer.tsx":
    "file tabs share the pill tab look of the editor (#660)",
};

function sourceFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx") && !file.includes(".test."))
    .map((file) => relative(process.cwd(), join(SRC, file)).split(sep).join("/"));
}

/** A raw `<button>`, or an `<input>` that is not a hidden file picker. */
function rawControls(source: string): string[] {
  const found = source.match(/<button[\s>]/g) ?? [];
  const inputs = source.match(/<input\b[^>]*>/gs) ?? [];
  return [...found, ...inputs.filter((tag) => !/type="file"/.test(tag))];
}

describe("controls", () => {
  it("come from the base components instead of raw buttons and inputs", () => {
    const offenders = sourceFiles()
      .filter((file) => !file.startsWith(UI_DIR.split(sep).join("/")) && !(file in ALLOWED))
      .filter((file) => rawControls(readFileSync(file, "utf8")).length > 0);

    expect(offenders).toEqual([]);
  });

  it("allows only files that still need the exception", () => {
    const stale = Object.keys(ALLOWED).filter(
      (file) => rawControls(readFileSync(file, "utf8")).length === 0,
    );

    expect(stale).toEqual([]);
  });
});
