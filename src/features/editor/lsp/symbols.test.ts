import { describe, expect, it } from "vite-plus/test";

import { symbolKindName } from "./symbols";

describe("symbolKindName", () => {
  it("names the common symbol kinds", () => {
    expect(symbolKindName(5)).toBe("class");
    expect(symbolKindName(6)).toBe("method");
    expect(symbolKindName(11)).toBe("interface");
    expect(symbolKindName(12)).toBe("function");
    expect(symbolKindName(13)).toBe("variable");
  });

  it("falls back to symbol for unknown kinds", () => {
    expect(symbolKindName(999)).toBe("symbol");
  });
});
