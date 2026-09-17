import { describe, expect, it, vi } from "vite-plus/test";
import { EditorState } from "@codemirror/state";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("./client", () => ({ lspInlayHint: vi.fn() }));

import { inlayHintDecorations, lspInlayHintPosition, toInlayHintRenders } from "./inlayHints";
import type { LspInlayHint } from "./client";

const doc = EditorState.create({ doc: "const x = 1;\nlet value = 2;\nreturn value;" }).doc;

function hint(partial: Partial<LspInlayHint>): LspInlayHint {
  return {
    position: { line: 0, character: 0 },
    label: "hint",
    paddingLeft: false,
    paddingRight: false,
    ...partial,
  };
}

describe("lspInlayHintPosition", () => {
  it("maps zero-based line and character to an offset", () => {
    expect(lspInlayHintPosition(doc, 1, 4)).toBe(17);
  });

  it("clamps out-of-range lines and characters", () => {
    expect(lspInlayHintPosition(doc, 99, 0)).toBe(doc.line(doc.lines).from);
    expect(lspInlayHintPosition(doc, -3, -1)).toBe(0);
    expect(lspInlayHintPosition(doc, 0, 999)).toBe(doc.line(1).to);
  });
});

describe("toInlayHintRenders", () => {
  it("maps, filters empty labels and sorts by position", () => {
    const renders = toInlayHintRenders(
      [
        hint({ position: { line: 2, character: 7 }, label: ": number", kind: 1 }),
        hint({ position: { line: 0, character: 5 }, label: "" }),
        hint({ position: { line: 1, character: 5 }, label: ": string", paddingLeft: true }),
      ],
      doc,
    );

    expect(renders.map((render) => render.label)).toEqual([": string", ": number"]);
    expect(renders[0].pos).toBeLessThan(renders[1].pos);
    expect(renders[0].paddingLeft).toBe(true);
    expect(renders[1].paddingRight).toBe(false);
  });

  it("keeps padding flags per hint", () => {
    const renders = toInlayHintRenders(
      [hint({ label: "x", paddingLeft: true, paddingRight: true })],
      doc,
    );
    expect(renders[0].paddingLeft).toBe(true);
    expect(renders[0].paddingRight).toBe(true);
  });

  it("returns no renders for an empty response", () => {
    expect(toInlayHintRenders([], doc)).toEqual([]);
  });
});

describe("inlayHintDecorations", () => {
  it("builds one decoration per render", () => {
    const decorations = inlayHintDecorations(
      toInlayHintRenders(
        [hint({ label: "a" }), hint({ position: { line: 1, character: 0 }, label: "b" })],
        doc,
      ),
    );
    expect(decorations.size).toBe(2);
  });
});
