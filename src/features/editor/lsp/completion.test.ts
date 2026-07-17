import { describe, expect, it } from "vite-plus/test";

import { documentationToText, mapCompletionItem } from "./completion";

describe("mapCompletionItem", () => {
  it("maps LSP kinds to CodeMirror completion types", () => {
    expect(mapCompletionItem({ label: "foo", kind: 3 }).type).toBe("function");
    expect(mapCompletionItem({ label: "Foo", kind: 7 }).type).toBe("class");
    expect(mapCompletionItem({ label: "bar", kind: 6 }).type).toBe("variable");
    expect(mapCompletionItem({ label: "x" }).type).toBe("text");
  });

  it("falls back to label for sortText and apply", () => {
    const completion = mapCompletionItem({ label: "console" });
    expect(completion.sortText).toBe("console");
    expect(completion.apply).toBe("console");
  });

  it("prefers insertText over label for apply", () => {
    expect(mapCompletionItem({ label: "log", insertText: "console.log" }).apply).toBe(
      "console.log",
    );
  });

  it("keeps detail for the label suffix", () => {
    expect(mapCompletionItem({ label: "map", detail: "(method)" }).detail).toBe("(method)");
  });
});

describe("documentationToText", () => {
  it("passes plain strings through", () => {
    expect(documentationToText("docs")).toBe("docs");
  });

  it("extracts value from MarkupContent", () => {
    expect(documentationToText({ kind: "markdown", value: "**docs**" })).toBe("**docs**");
  });

  it("returns null for missing or empty documentation", () => {
    expect(documentationToText(undefined)).toBeNull();
    expect(documentationToText(null)).toBeNull();
    expect(documentationToText("")).toBeNull();
  });
});
