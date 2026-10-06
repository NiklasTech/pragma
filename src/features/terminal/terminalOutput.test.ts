import { describe, expect, it } from "vite-plus/test";

import { tailLines } from "./terminalOutput";

describe("tailLines", () => {
  it("keeps the last lines and drops trailing blank rows", () => {
    expect(tailLines(["a", "b", "c", "", "  "], 2)).toBe("b\nc");
  });

  it("returns everything when there are fewer lines than the limit", () => {
    expect(tailLines(["a", "b"], 10)).toBe("a\nb");
    expect(tailLines(["", ""], 10)).toBe("");
  });
});
