import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { APP_MENU_FOOTER, APP_MENU_GROUPS, type AppMenuEntry } from "./appMenuModel";

/** The action ids of the native macOS menu, read from its Rust source. */
function nativeMenuActions(): string[] {
  const source = readFileSync(join(process.cwd(), "src-tauri", "src", "app_menu.rs"), "utf8");
  const list = source.slice(source.indexOf("const MENU_ACTION_IDS"), source.indexOf("];"));
  return [...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function ids(entries: readonly AppMenuEntry[]): string[] {
  return entries.flatMap((entry) =>
    entry.kind === "action" || entry.kind === "toggle" ? [entry.id] : [],
  );
}

describe("app menu", () => {
  it("offers every action of the native macOS menu", () => {
    const drawn = new Set([
      ...APP_MENU_GROUPS.flatMap((group) => ids(group.entries)),
      ...ids(APP_MENU_FOOTER),
    ]);
    const missing = nativeMenuActions().filter((id) => !drawn.has(id));
    expect(missing).toEqual([]);
  });

  it("lists each action once", () => {
    const all = [
      ...APP_MENU_GROUPS.flatMap((group) => ids(group.entries)),
      ...ids(APP_MENU_FOOTER),
    ];
    const repeated = all.filter((id, index) => all.indexOf(id) !== index);
    expect(repeated).toEqual(["view.toggleTerminal"]);
  });
});
