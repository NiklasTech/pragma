import { describe, expect, it } from "vite-plus/test";

import { parseInlineNodes, parseMarkdownSegments } from "./markdown-lite";

describe("parseMarkdownSegments", () => {
  it("parses a fenced code block with a language", () => {
    expect(parseMarkdownSegments("```typescript\nconst x: number\n```")).toEqual([
      { kind: "code", language: "typescript", code: "const x: number" },
    ]);
  });

  it("parses text before and after a code block", () => {
    expect(parseMarkdownSegments("Some docs\n\n```rust\nfn main() {}\n```\n\nMore docs")).toEqual([
      { kind: "text", text: "Some docs" },
      { kind: "code", language: "rust", code: "fn main() {}" },
      { kind: "text", text: "More docs" },
    ]);
  });

  it("parses a fenced block without a language", () => {
    expect(parseMarkdownSegments("```\nplain\n```")).toEqual([
      { kind: "code", language: null, code: "plain" },
    ]);
  });

  it("keeps multiple code blocks separate", () => {
    expect(parseMarkdownSegments("```ts\na\n```\n\n```ts\nb\n```")).toEqual([
      { kind: "code", language: "ts", code: "a" },
      { kind: "code", language: "ts", code: "b" },
    ]);
  });

  it("treats an unterminated fence as plain text", () => {
    expect(parseMarkdownSegments("before\n```ts\nnever closed")).toEqual([
      { kind: "text", text: "before\n```ts\nnever closed" },
    ]);
  });

  it("returns a single text segment for plain text", () => {
    expect(parseMarkdownSegments("just docs")).toEqual([{ kind: "text", text: "just docs" }]);
  });

  it("drops empty text segments around fences", () => {
    expect(parseMarkdownSegments("```ts\na\n```")).toHaveLength(1);
  });
});

describe("parseInlineNodes", () => {
  it("parses inline code", () => {
    expect(parseInlineNodes("use `console.log` here")).toEqual([
      { kind: "text", text: "use " },
      { kind: "code", text: "console.log" },
      { kind: "text", text: " here" },
    ]);
  });

  it("parses bold text", () => {
    expect(parseInlineNodes("a **strong** word")).toEqual([
      { kind: "text", text: "a " },
      { kind: "bold", text: "strong" },
      { kind: "text", text: " word" },
    ]);
  });

  it("parses mixed inline code and bold", () => {
    expect(parseInlineNodes("**`x`** is set")).toEqual([
      { kind: "bold", text: "x" },
      { kind: "text", text: " is set" },
    ]);
  });

  it("leaves unclosed markers as literal text", () => {
    expect(parseInlineNodes("a `unclosed mark")).toEqual([
      { kind: "text", text: "a `unclosed mark" },
    ]);
    expect(parseInlineNodes("a **unclosed mark")).toEqual([
      { kind: "text", text: "a **unclosed mark" },
    ]);
  });

  it("returns plain text unchanged", () => {
    expect(parseInlineNodes("nothing special")).toEqual([
      { kind: "text", text: "nothing special" },
    ]);
  });
});
