import { describe, expect, it } from "vite-plus/test";

import { firstLspFailure } from "./lspToastOnce";

describe("firstLspFailure", () => {
  it("reports a failure once per language and message", () => {
    expect(firstLspFailure("typescript", "TypeScript missing")).toBe(true);
    expect(firstLspFailure("typescript", "TypeScript missing")).toBe(false);
    expect(firstLspFailure("rust", "TypeScript missing")).toBe(true);
    expect(firstLspFailure("typescript", "server crashed")).toBe(true);
  });
});
