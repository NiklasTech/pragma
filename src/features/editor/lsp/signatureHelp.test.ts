import { describe, expect, it } from "vite-plus/test";

import { splitActiveParameter } from "./signatureHelp";

describe("splitActiveParameter", () => {
  it("splits the label around the active parameter", () => {
    expect(splitActiveParameter("foo(a: number, b: string): void", "b: string")).toEqual([
      "foo(a: number, ",
      "b: string",
      "): void",
    ]);
  });

  it("handles the first parameter", () => {
    expect(splitActiveParameter("foo(a: number, b: string): void", "a: number")).toEqual([
      "foo(",
      "a: number",
      ", b: string): void",
    ]);
  });

  it("returns null when the parameter is not in the label", () => {
    expect(splitActiveParameter("foo(): void", "x: number")).toBeNull();
  });

  it("returns null for an empty parameter label", () => {
    expect(splitActiveParameter("foo(): void", "")).toBeNull();
  });
});
