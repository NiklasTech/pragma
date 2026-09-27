import { describe, expect, it } from "vite-plus/test";

import { restoreTitle } from "./restore";

describe("restoreTitle", () => {
  it("names the file and HEAD in the confirm title", () => {
    expect(restoreTitle("src/features/ai/review/rows.ts")).toBe(
      "Restore src/features/ai/review/rows.ts from HEAD?",
    );
  });
});
