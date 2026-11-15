import { describe, expect, it } from "vite-plus/test";

import { cn } from "./utils";

describe("cn", () => {
  it("lets a later radius replace the theme radii", () => {
    expect(cn("rounded-control", "rounded-full")).toBe("rounded-full");
    expect(cn("rounded-well", "rounded-sheet")).toBe("rounded-sheet");
  });

  it("keeps a UI text size next to a text color", () => {
    expect(cn("text-ui-sm", "text-fg-muted", "text-ui-xs")).toBe("text-fg-muted text-ui-xs");
  });
});
