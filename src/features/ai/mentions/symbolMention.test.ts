import { describe, expect, it } from "vite-plus/test";

import type { LspDocumentSymbolItem } from "@/features/editor/lsp/client";

import { pickSymbolRange } from "./symbolMention";

function symbol(name: string, start: number, end: number): LspDocumentSymbolItem {
  return {
    name,
    kind: 12,
    depth: 0,
    range: { start: { line: start, character: 0 }, end: { line: end, character: 1 } },
  };
}

describe("pickSymbolRange", () => {
  it("returns the smallest symbol with the name that covers the line", () => {
    const symbols = [symbol("run", 0, 40), symbol("run", 10, 20), symbol("other", 10, 12)];
    expect(pickSymbolRange(symbols, "run", 10)).toEqual({ start: 10, end: 20 });
  });

  it("returns null when no symbol with the name covers the line", () => {
    expect(pickSymbolRange([symbol("run", 0, 5)], "run", 8)).toBeNull();
    expect(pickSymbolRange([symbol("walk", 0, 5)], "run", 2)).toBeNull();
  });
});
