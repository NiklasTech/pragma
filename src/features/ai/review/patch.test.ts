import { describe, expect, it } from "vite-plus/test";

import { parsePatchHunks } from "@/shared/lib/diffHunks";

import { addedFilePatch } from "./patch";

describe("addedFilePatch", () => {
  it("builds one added hunk for a new file", () => {
    const patch = addedFilePatch("", "one\r\ntwo\n");

    expect(patch).toBe("@@ -0,0 +1,2 @@\n+one\n+two");
    expect(parsePatchHunks(patch)[0]?.lines.map((line) => line.newLine)).toEqual([1, 2]);
  });

  it("returns nothing when the file has an original side or no content", () => {
    expect(addedFilePatch("before", "after")).toBe("");
    expect(addedFilePatch("", "")).toBe("");
  });
});
