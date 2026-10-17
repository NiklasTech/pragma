import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { normalizeSettingText } from "./revealSetting";
import { SEARCH_ITEMS } from "./settings-search-items";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return entry.name.endsWith(".tsx") ? [readFileSync(path, "utf8")] : [];
  });
}

const pages = sources(join(process.cwd(), "src/features/settings/components"));
// Labels appear as label="..." props, title="..." props or text between tags.
const visibleTexts = new Set(
  pages.flatMap((source) =>
    [...source.matchAll(/(?:label|title)="([^"]+)"|>\s*([A-Z][^<>{}\n]*?)\s*</g)].map((match) =>
      normalizeSettingText(match[1] ?? match[2] ?? ""),
    ),
  ),
);

describe("settings search items", () => {
  it("jump to a text that is shown on a settings page", () => {
    const missing = SEARCH_ITEMS.filter((item) => item.id !== "keyboard-shortcuts")
      .map((item) => item.target ?? item.label)
      .filter((target) => !visibleTexts.has(normalizeSettingText(target)));
    expect(missing).toEqual([]);
  });

  it("have unique ids", () => {
    const ids = SEARCH_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
