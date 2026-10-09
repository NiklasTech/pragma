import { describe, expect, it } from "vite-plus/test";

import { encodingLabel, FILE_ENCODINGS } from "./encodings";

describe("file encodings", () => {
  it("labels missing and UTF-16 encodings for the status bar", () => {
    expect(encodingLabel(undefined)).toBe("UTF-8");
    expect(encodingLabel("UTF-16LE")).toBe("UTF-16 LE");
    expect(encodingLabel("windows-1252")).toBe("windows-1252");
  });

  it("offers each encoding once, starting with UTF-8", () => {
    const values = FILE_ENCODINGS.map((item) => item.value);
    expect(values[0]).toBe("UTF-8");
    expect(new Set(values).size).toBe(values.length);
  });
});
